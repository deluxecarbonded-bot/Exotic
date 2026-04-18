-- ============================================================
-- Migration: Add Telegram-style channel features
-- Tables: channel_invites, channel_post_comments, channel_mutes
-- Columns: channel_posts.edited_at, scheduled_for, is_draft, comments_count
-- Functions: increment_post_views, increment/decrement_channel_post_comments,
--            increment/decrement_channel_subscribers
-- Applied: 2026-04-18
-- ============================================================

-- 1. Add missing columns to channel_posts
ALTER TABLE channel_posts ADD COLUMN IF NOT EXISTS edited_at timestamptz DEFAULT NULL;
ALTER TABLE channel_posts ADD COLUMN IF NOT EXISTS scheduled_for timestamptz DEFAULT NULL;
ALTER TABLE channel_posts ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;
ALTER TABLE channel_posts ADD COLUMN IF NOT EXISTS comments_count integer DEFAULT 0;

-- 2. Create channel_invites table
CREATE TABLE IF NOT EXISTS channel_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  expires_at timestamptz DEFAULT NULL,
  max_uses integer DEFAULT NULL,
  uses_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_invites_code ON channel_invites(code);
CREATE INDEX IF NOT EXISTS idx_channel_invites_channel ON channel_invites(channel_id);

-- 3. Create channel_post_comments table
CREATE TABLE IF NOT EXISTS channel_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES channel_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid DEFAULT NULL REFERENCES channel_post_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_post_comments_post ON channel_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_channel_post_comments_parent ON channel_post_comments(parent_id);

-- 4. Create channel_mutes table
CREATE TABLE IF NOT EXISTS channel_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_mutes_user ON channel_mutes(user_id);

-- 5. RPC functions
CREATE OR REPLACE FUNCTION increment_post_views(p_post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE channel_posts SET views_count = views_count + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_channel_post_comments(p_post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE channel_posts SET comments_count = comments_count + 1 WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_channel_post_comments(p_post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE channel_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_channel_subscribers(cid uuid)
RETURNS void AS $$
BEGIN
  UPDATE channels SET subscribers_count = subscribers_count + 1 WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_channel_subscribers(cid uuid)
RETURNS void AS $$
BEGIN
  UPDATE channels SET subscribers_count = GREATEST(subscribers_count - 1, 0) WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable RLS on new tables
ALTER TABLE channel_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_mutes ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for channel_invites
CREATE POLICY "Anyone can read active invites" ON channel_invites
  FOR SELECT USING (is_active = true);

CREATE POLICY "Channel admins can insert invites" ON channel_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_invites.channel_id
        AND channel_members.user_id = auth.uid()
        AND channel_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Channel admins can update invites" ON channel_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channel_invites.channel_id
        AND channel_members.user_id = auth.uid()
        AND channel_members.role IN ('owner', 'admin')
    )
  );

-- 8. RLS policies for channel_post_comments
CREATE POLICY "Anyone can read comments" ON channel_post_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert comments" ON channel_post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON channel_post_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Channel admins can delete comments" ON channel_post_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM channel_posts cp
      JOIN channel_members cm ON cm.channel_id = cp.channel_id
      WHERE cp.id = channel_post_comments.post_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- 9. RLS policies for channel_mutes
CREATE POLICY "Users can read own mutes" ON channel_mutes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mutes" ON channel_mutes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mutes" ON channel_mutes
  FOR DELETE USING (auth.uid() = user_id);

-- 10. UPDATE policies for existing tables
CREATE POLICY "cp_update" ON channel_posts FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM channel_members
    WHERE channel_members.channel_id = channel_posts.channel_id
      AND channel_members.user_id = auth.uid()
      AND channel_members.role IN ('owner', 'admin')
  )
);

CREATE POLICY "cm_update" ON channel_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM channel_members cm2
    WHERE cm2.channel_id = channel_members.channel_id
      AND cm2.user_id = auth.uid()
      AND cm2.role IN ('owner', 'admin')
  )
);

-- 11. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE channel_post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_invites;
