# Supabase Database Setup

For the application to function correctly with Supabase sync, your database needs to have the correct tables and security policies. Run the following SQL queries in your project's **SQL Editor** in the Supabase Dashboard.

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
  coverArtUrl text NULL,
  notes text NULL,
  version text NULL,
  recordLabel text NULL,
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
  coverArtUrl text NULL,
  notes text NULL,
  version text NULL,
  recordLabel text NULL,
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

## 3. Migration: Renaming `cds` to `collection`

If you have already created the `cds` table, run this to rename it without losing your data:

```sql
-- Rename the table
ALTER TABLE IF EXISTS public.cds RENAME TO collection;

-- (Optional) Update constraints and policies names if you want them to match exactly, 
-- though Supabase/Postgres often handles the renaming of constraints automatically.
```

## 4. Column Parity Fixes

If your tables already exist and you need to ensure they have the `format` column:

```sql
-- Add format to collection table
ALTER TABLE public.collection
ADD COLUMN IF NOT EXISTS "format" text NULL DEFAULT 'cd';

-- Add format to wantlist table
ALTER TABLE public.wantlist
ADD COLUMN IF NOT EXISTS "format" text NULL DEFAULT 'cd';
```