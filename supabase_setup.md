# Supabase Database Setup

For the application to function correctly with Supabase sync, your database needs to have the correct tables and security policies. Run the following SQL queries in your project's **SQL Editor** in the Supabase Dashboard.

## CRITICAL: Required Columns
If you are seeing an error like `Could not find the 'format' column`, you MUST run the **Migration** section at the bottom of this file.

## 1. Collection Table

```sql
-- Create the main table for the collection
CREATE TABLE public.collection (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  genre text NULL,
  year integer NULL,
  cover_art_url text NULL,
  notes text NULL,
  version text NULL,
  record_label text NULL,
  tags text[] NULL,
  format text NULL DEFAULT 'cd', -- differentiation for cd/vinyl
  CONSTRAINT collection_pkey PRIMARY KEY (id),
  CONSTRAINT collection_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own items" ON public.collection FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable insert for own items" ON public.collection FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for own items" ON public.collection FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for own items" ON public.collection FOR DELETE USING (auth.uid() = user_id);
```

## 2. Wantlist Table

```sql
CREATE TABLE public.wantlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  genre text NULL,
  year integer NULL,
  cover_art_url text NULL,
  notes text NULL,
  version text NULL,
  record_label text NULL,
  tags text[] NULL,
  format text NULL DEFAULT 'cd',
  CONSTRAINT wantlist_pkey PRIMARY KEY (id),
  CONSTRAINT wantlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.wantlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own wantlist items" ON public.wantlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable insert for own wantlist items" ON public.wantlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for own wantlist items" ON public.wantlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for own wantlist items" ON public.wantlist FOR DELETE USING (auth.uid() = user_id);
```

## 3. Migration: Updating existing tables

If you have already created the tables and are getting errors about missing columns, run this:

```sql
-- Fix Column Names (if camelCase)
ALTER TABLE IF EXISTS public.collection RENAME COLUMN "coverArtUrl" TO cover_art_url;
ALTER TABLE IF EXISTS public.collection RENAME COLUMN "recordLabel" TO record_label;
ALTER TABLE IF EXISTS public.wantlist RENAME COLUMN "coverArtUrl" TO cover_art_url;
ALTER TABLE IF EXISTS public.wantlist RENAME COLUMN "recordLabel" TO record_label;

-- Add Missing 'format' Column
ALTER TABLE public.collection ADD COLUMN IF NOT EXISTS format text DEFAULT 'cd';
ALTER TABLE public.wantlist ADD COLUMN IF NOT EXISTS format text DEFAULT 'cd';
```