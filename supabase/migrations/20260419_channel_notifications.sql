-- ═══════════════════════════════════════════════════════════════════════════════
-- Channel Notifications System
-- Creates DB functions + triggers to auto-generate notifications for channel events
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add channel_id column to notifications for deep-linking
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES channels(id) ON DELETE CASCADE;

-- Create index for efficient channel notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_channel_id ON notifications(channel_id) WHERE channel_id IS NOT NULL;

-- ─── Helper: Create channel notification for all subscribers (respects mutes) ──
CREATE OR REPLACE FUNCTION notify_channel_subscribers(
  p_channel_id uuid,
  p_actor_id uuid,
  p_type text,
  p_message text,
  p_target_id uuid,
  p_target_type text
) RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id, message, target_id, target_type, channel_id, is_read)
  SELECT
    cm.user_id,
    p_type,
    p_actor_id,
    p_message,
    p_target_id,
    p_target_type,
    p_channel_id,
    false
  FROM channel_members cm
  WHERE cm.channel_id = p_channel_id
    AND cm.user_id != p_actor_id
    -- Respect muted channels
    AND NOT EXISTS (
      SELECT 1 FROM channel_mutes mut
      WHERE mut.channel_id = p_channel_id AND mut.user_id = cm.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Trigger: New channel post → notify all subscribers ─────────────────────
CREATE OR REPLACE FUNCTION on_channel_post_created() RETURNS trigger AS $$
DECLARE
  v_channel_name text;
  v_actor_name text;
BEGIN
  -- Skip drafts / scheduled posts
  IF NEW.is_draft = true THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_channel_name FROM channels WHERE id = NEW.channel_id;
  SELECT display_name INTO v_actor_name FROM profiles WHERE id = NEW.user_id;

  PERFORM notify_channel_subscribers(
    NEW.channel_id,
    NEW.user_id,
    'channel_new_post',
    CASE
      WHEN NEW.posted_as = 'channel' THEN 'posted in ' || COALESCE(v_channel_name, 'a channel')
      ELSE 'posted in ' || COALESCE(v_channel_name, 'a channel')
    END,
    NEW.id,
    'channel_post'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_channel_post_notify ON channel_posts;
CREATE TRIGGER trg_channel_post_notify
  AFTER INSERT ON channel_posts
  FOR EACH ROW
  EXECUTE FUNCTION on_channel_post_created();

-- ─── Trigger: Channel post comment → notify post author + parent comment author ─
CREATE OR REPLACE FUNCTION on_channel_comment_created() RETURNS trigger AS $$
DECLARE
  v_post_author_id uuid;
  v_channel_id uuid;
  v_parent_author_id uuid;
  v_channel_name text;
BEGIN
  -- Get the post author and channel
  SELECT cp.user_id, cp.channel_id INTO v_post_author_id, v_channel_id
  FROM channel_posts cp WHERE cp.id = NEW.post_id;

  SELECT name INTO v_channel_name FROM channels WHERE id = v_channel_id;

  -- Notify post author (if not self)
  IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.user_id THEN
    -- Check mute
    IF NOT EXISTS (SELECT 1 FROM channel_mutes WHERE channel_id = v_channel_id AND user_id = v_post_author_id) THEN
      INSERT INTO notifications (user_id, type, actor_id, message, target_id, target_type, channel_id, is_read)
      VALUES (
        v_post_author_id,
        'channel_post_comment',
        NEW.user_id,
        'commented on your post in ' || COALESCE(v_channel_name, 'a channel'),
        NEW.post_id,
        'channel_post',
        v_channel_id,
        false
      );
    END IF;
  END IF;

  -- Notify parent comment author for replies (if not self, not same as post author)
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author_id
    FROM channel_post_comments WHERE id = NEW.parent_id;

    IF v_parent_author_id IS NOT NULL
      AND v_parent_author_id != NEW.user_id
      AND v_parent_author_id != COALESCE(v_post_author_id, '00000000-0000-0000-0000-000000000000'::uuid)
    THEN
      IF NOT EXISTS (SELECT 1 FROM channel_mutes WHERE channel_id = v_channel_id AND user_id = v_parent_author_id) THEN
        INSERT INTO notifications (user_id, type, actor_id, message, target_id, target_type, channel_id, is_read)
        VALUES (
          v_parent_author_id,
          'channel_comment_reply',
          NEW.user_id,
          'replied to your comment in ' || COALESCE(v_channel_name, 'a channel'),
          NEW.post_id,
          'channel_post',
          v_channel_id,
          false
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_channel_comment_notify ON channel_post_comments;
CREATE TRIGGER trg_channel_comment_notify
  AFTER INSERT ON channel_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION on_channel_comment_created();

-- ─── Trigger: Channel post reaction → notify post author ────────────────────
CREATE OR REPLACE FUNCTION on_channel_reaction_created() RETURNS trigger AS $$
DECLARE
  v_post_author_id uuid;
  v_channel_id uuid;
  v_channel_name text;
BEGIN
  SELECT cp.user_id, cp.channel_id INTO v_post_author_id, v_channel_id
  FROM channel_posts cp WHERE cp.id = NEW.post_id;

  -- Don't notify self-reactions
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Check mute
  IF EXISTS (SELECT 1 FROM channel_mutes WHERE channel_id = v_channel_id AND user_id = v_post_author_id) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_channel_name FROM channels WHERE id = v_channel_id;

  INSERT INTO notifications (user_id, type, actor_id, message, target_id, target_type, channel_id, is_read)
  VALUES (
    v_post_author_id,
    'channel_post_reaction',
    NEW.user_id,
    'reacted ' || NEW.emoji || ' to your post in ' || COALESCE(v_channel_name, 'a channel'),
    NEW.post_id,
    'channel_post',
    v_channel_id,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_channel_reaction_notify ON channel_post_reactions;
CREATE TRIGGER trg_channel_reaction_notify
  AFTER INSERT ON channel_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION on_channel_reaction_created();

-- ─── Trigger: New member joins → notify channel owner + admins ──────────────
CREATE OR REPLACE FUNCTION on_channel_member_joined() RETURNS trigger AS $$
DECLARE
  v_channel_name text;
BEGIN
  -- Only notify for 'member' role joins (not owner creation)
  IF NEW.role != 'member' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_channel_name FROM channels WHERE id = NEW.channel_id;

  -- Notify owner and admins
  INSERT INTO notifications (user_id, type, actor_id, message, target_id, target_type, channel_id, is_read)
  SELECT
    cm.user_id,
    'channel_member_joined',
    NEW.user_id,
    'joined ' || COALESCE(v_channel_name, 'your channel'),
    NEW.channel_id,
    'channel',
    NEW.channel_id,
    false
  FROM channel_members cm
  WHERE cm.channel_id = NEW.channel_id
    AND cm.role IN ('owner', 'admin')
    AND cm.user_id != NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM channel_mutes mut
      WHERE mut.channel_id = NEW.channel_id AND mut.user_id = cm.user_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_channel_member_joined_notify ON channel_members;
CREATE TRIGGER trg_channel_member_joined_notify
  AFTER INSERT ON channel_members
  FOR EACH ROW
  EXECUTE FUNCTION on_channel_member_joined();

-- ─── Trigger: Member role changed → notify the affected member ──────────────
CREATE OR REPLACE FUNCTION on_channel_role_changed() RETURNS trigger AS $$
DECLARE
  v_channel_name text;
BEGIN
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_channel_name FROM channels WHERE id = NEW.channel_id;

  INSERT INTO notifications (user_id, type, actor_id, message, target_id, target_type, channel_id, is_read)
  VALUES (
    NEW.user_id,
    'channel_role_changed',
    NULL,
    CASE
      WHEN NEW.role = 'admin' THEN 'You were promoted to admin in ' || COALESCE(v_channel_name, 'a channel')
      WHEN NEW.role = 'member' THEN 'You were changed to member in ' || COALESCE(v_channel_name, 'a channel')
      ELSE 'Your role was updated in ' || COALESCE(v_channel_name, 'a channel')
    END,
    NEW.channel_id,
    'channel',
    NEW.channel_id,
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_channel_role_changed_notify ON channel_members;
CREATE TRIGGER trg_channel_role_changed_notify
  AFTER UPDATE ON channel_members
  FOR EACH ROW
  EXECUTE FUNCTION on_channel_role_changed();

-- ─── Trigger: Post pinned → notify all subscribers ──────────────────────────
CREATE OR REPLACE FUNCTION on_channel_post_pinned() RETURNS trigger AS $$
DECLARE
  v_channel_name text;
BEGIN
  -- Only trigger when is_pinned changes from false to true
  IF OLD.is_pinned = true OR NEW.is_pinned = false THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_channel_name FROM channels WHERE id = NEW.channel_id;

  PERFORM notify_channel_subscribers(
    NEW.channel_id,
    NEW.user_id,
    'channel_post_pinned',
    'pinned a post in ' || COALESCE(v_channel_name, 'a channel'),
    NEW.id,
    'channel_post'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_channel_post_pinned_notify ON channel_posts;
CREATE TRIGGER trg_channel_post_pinned_notify
  AFTER UPDATE ON channel_posts
  FOR EACH ROW
  EXECUTE FUNCTION on_channel_post_pinned();
