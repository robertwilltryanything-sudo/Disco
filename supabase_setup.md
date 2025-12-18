# Supabase Database Setup

For the application to function correctly with Supabase sync, your database needs to have the correct tables and security policies. Run the following SQL queries in your project's **SQL Editor** in the Supabase Dashboard.

## 1. CDs Table

```sql
-- Create the main table for the CD collection
CREATE TABLE public.cds (
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
  format text NULL DEFAULT 'cd', -- New column for format differentiation
  CONSTRAINT cds_pkey PRIMARY KEY (id),
  CONSTRAINT cds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.cds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own items" ON public.cds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable insert for own items" ON public.cds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for own items" ON public.cds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for own items" ON public.cds FOR DELETE USING (auth.uid() = user_id);
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
  format text NULL DEFAULT 'cd', -- New column for format differentiation
  CONSTRAINT wantlist_pkey PRIMARY KEY (id),
  CONSTRAINT wantlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.wantlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own wantlist items" ON public.wantlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable insert for own wantlist items" ON public.wantlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable update for own wantlist items" ON public.wantlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for own wantlist items" ON public.wantlist FOR DELETE USING (auth.uid() = user_id);
```

## 3. Fixes for Existing Tables (REQUIRED IF YOU ALREADY DEPLOYED)

If your tables already exist, run these commands to add the `format` column without losing data:

```sql
-- Add format to cds table
ALTER TABLE public.cds
ADD COLUMN IF NOT EXISTS "format" text NULL DEFAULT 'cd';

-- Add format to wantlist table
ALTER TABLE public.wantlist
ADD COLUMN IF NOT EXISTS "format" text NULL DEFAULT 'cd';

-- If your wantlist was missing other parity columns:
ALTER TABLE public.wantlist
ADD COLUMN IF NOT EXISTS "genre" text NULL,
ADD COLUMN IF NOT EXISTS "year" integer NULL,
ADD COLUMN IF NOT EXISTS "version" text NULL,
ADD COLUMN IF NOT EXISTS "recordLabel" text NULL,
ADD COLUMN IF NOT EXISTS "tags" text[] NULL,
ADD COLUMN IF NOT EXISTS "coverArtUrl" text NULL;
```