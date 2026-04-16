# Full Supabase Implementation Plan for Exotic

## Overview
Reset Supabase database completely, create all tables with proper schema, RLS policies, triggers, and wire up every route/store/component to use real Supabase data with real-time subscriptions.

---

## Phase 1: Supabase Database Setup (Fresh Reset)

### 1.1 Create `.env` file with all Supabase credentials
Save all provided credentials to `.env` at project root.

### 1.2 Reset & Create Database Schema via SQL
Execute SQL against Supabase to create all tables fresh:

**Tables:**
- `profiles` — user profiles (linked to auth.users via trigger)
  - id (uuid, FK → auth.users), username (unique), display_name, bio, avatar_url, is_verified, is_private, allow_anonymous, followers_count, following_count, answers_count, questions_asked_count, created_at, updated_at
- `questions` — anonymous/named questions
  - id (uuid), content, sender_id (nullable FK → profiles), receiver_id (FK → profiles), is_anonymous, is_answered, created_at
- `answers` — answers to questions
  - id (uuid), content, question_id (FK → questions, unique), user_id (FK → profiles), likes_count, comments_count, shares_count, created_at
- `follows` — follow relationships
  - id (uuid), follower_id (FK → profiles), following_id (FK → profiles), created_at, UNIQUE(follower_id, following_id)
- `answer_likes` — like tracking
  - id (uuid), user_id (FK → profiles), answer_id (FK → answers), created_at, UNIQUE(user_id, answer_id)
- `notifications` — notification system
  - id (uuid), user_id (FK → profiles), type, actor_id (FK → profiles), target_id, target_type, message, is_read, created_at
- `comments` — answer comments
  - id (uuid), content, user_id (FK → profiles), answer_id (FK → answers), parent_id (nullable self-FK), likes_count, created_at

**Triggers:**
- `on_auth_user_created` → auto-create profile from auth.users metadata (username, display_name)
- `update_followers_count` → increment/decrement on follows insert/delete
- `update_following_count` → increment/decrement on follows insert/delete
- `update_answers_count` → increment/decrement on answers insert/delete
- `update_likes_count` → increment/decrement on answer_likes insert/delete

**RLS Policies:**
- profiles: public read, authenticated update own
- questions: authenticated insert, users read own received/sent
- answers: authenticated insert, public read
- follows: authenticated insert/delete own, public read
- answer_likes: authenticated insert/delete own, public read
- notifications: users read/update own
- comments: authenticated insert, public read

**Realtime:**
- Enable realtime on: questions, answers, follows, notifications, answer_likes

---

## Phase 2: Wire Up Stores to Real Supabase (Already Mostly Done)

The stores (`auth-store`, `question-store`, `follow-store`, `notification-store`) already have Supabase queries. They need minor fixes:

### 2.1 `auth-store.ts`
- Already functional ✓
- Fix: `answerQuestion` in inbox route passes `userId` from auth store correctly

### 2.2 `question-store.ts`
- Already has full CRUD + realtime ✓
- Fix: `toggleLike` needs to also check existing likes on feed load (fetch user's liked answer IDs)
- Add: `checkLikes(userId, answerIds)` to mark `is_liked` on feed items

### 2.3 `follow-store.ts`
- Already functional ✓
- Fix: `toggleFollow` needs to also update `followers_count`/`following_count` via DB triggers

### 2.4 `notification-store.ts`
- Already functional ✓

---

## Phase 3: Wire Up Routes to Real Data

### 3.1 `home.tsx` — Feed
- On mount: call `fetchFeed()` with followed user IDs from follow store
- Call `fetchFollowing()` first to get the list, then `fetchFeed(followedIds)`
- Add `checkLikes()` after feed loads
- Wire `handleRefresh` to actually refetch

### 3.2 `profile.$username.tsx` — Profile
- Fetch profile user from Supabase by username (not just auth user)
- Fetch user's answers via `fetchUserAnswers()`
- Fetch followers/following lists for dialogs
- Wire follow button to use `followStore.toggleFollow()` with correct IDs
- Wire `AskQuestionBox` to use correct receiver ID from fetched profile
- Fetch liked answers for "Likes" tab

### 3.3 `inbox.tsx` — Inbox
- Call `fetchInbox(userId)` on mount
- Wire `handleSubmitAnswer` to pass auth user's ID
- Remove manual `addAnswer` call (store handles it)

### 3.4 `discover.tsx` — Discover
- Fetch trending users (most followed/most answers recently)
- Fetch suggested users (not already followed by current user)
- Wire follow buttons to use store

### 3.5 `search.tsx` — Search
- Replace mock search with real Supabase queries
- Search profiles by username/display_name using `ilike`
- Search answers by content using `ilike`
- Search questions by content using `ilike`

### 3.6 `ask.$username.tsx` — Ask Question
- Look up target user by username from Supabase
- Pass correct `receiverId` to `askQuestion()`
- Pass `senderId` from auth store if not anonymous

### 3.7 `notifications.tsx` — Notifications
- Call `fetchNotifications(userId)` on mount
- Wire `markAllAsRead` to pass `userId`

### 3.8 `settings.tsx` — Settings
- Wire "Save changes" to `updateProfile()` with all fields
- Wire privacy toggles to save to profile (allow_anonymous, is_private)
- Wire "Sign out" (already done ✓)
- Wire "Delete account" to delete profile + auth user
- Wire "Change password" to Supabase auth.updateUser

### 3.9 `cards.tsx` — Answer/Question/User cards
- Wire `AnswerCard` like button to `toggleLike()` from store
- Wire `AnswerCard` delete to `deleteAnswer()` from store
- Wire `AnswerCard` copy link
- Wire `UserCard` follow to `toggleFollow()` from store

---

## Phase 4: Data Initialization & Loading

### 4.1 Add `useEffect` data loading hooks
- `home.tsx`: useEffect to fetch feed + check likes on mount/user change
- `inbox.tsx`: useEffect to fetch inbox on mount
- `notifications.tsx`: useEffect to fetch notifications on mount
- `profile.$username.tsx`: useEffect to fetch profile + answers by username
- `discover.tsx`: useEffect to fetch trending + suggested users
- `settings.tsx`: sync local state when auth user changes

### 4.2 Auth-gated data loading
- Wrap data fetching in auth checks — skip if not logged in
- Redirect to /login from protected routes (inbox, notifications, settings)

---

## Phase 5: Real-time Enhancements

### 5.1 Already done in stores ✓
- Questions realtime (new questions appear in inbox)
- Answers realtime (new answers appear in feed)
- Notifications realtime (new notifications with badge count)
- Follows realtime (followers list updates)

### 5.2 Additional realtime
- Answer likes realtime: subscribe to `answer_likes` changes to update like counts live
- Profile stats realtime: subscribe to profile row changes for live follower/answer counts
- Feed auto-refresh when new answers from followed users arrive

---

## File Changes Summary

| File | Changes |
|------|---------|
| `.env` | NEW — all Supabase credentials |
| SQL (run via script) | Create all tables, triggers, RLS, enable realtime |
| `app/stores/question-store.ts` | Add `checkLikes()`, fix feed loading |
| `app/routes/home.tsx` | Add data loading, wire refresh, check likes |
| `app/routes/profile.$username.tsx` | Fetch real profile, answers, followers, likes tab |
| `app/routes/inbox.tsx` | Add data loading, fix answer submission |
| `app/routes/discover.tsx` | Fetch trending + suggested users |
| `app/routes/search.tsx` | Real Supabase search queries |
| `app/routes/ask.$username.tsx` | Look up user, pass correct IDs |
| `app/routes/notifications.tsx` | Add data loading |
| `app/routes/settings.tsx` | Wire all save/delete/password functions |
| `app/components/cards.tsx` | Wire like, delete, follow actions to stores |
| `app/hooks/use-realtime.ts` | Already done ✓ |

---

## Execution Order
1. Create `.env` file
2. Run SQL to reset + create database
3. Update stores (add `checkLikes`, minor fixes)
4. Update all routes one by one with data loading + real actions
5. Update cards component with real actions
6. Build + deploy + test
