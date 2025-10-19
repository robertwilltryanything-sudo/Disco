# Supabase Database Setup

For the application to function correctly with Supabase sync, your database needs to have the correct tables and security policies. Run the following SQL queries in your project's **SQL Editor** in the Supabase Dashboard.

If you are starting a new project, you should run both scripts. If you are fixing an existing project, you may only need to run the script for the missing table.

## 1. CDs Table

This table stores the main CD collection.

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
  CONSTRAINT cds_pkey PRIMARY KEY (id),
  CONSTRAINT cds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add comments for clarity
COMMENT ON TABLE public.cds IS 'Stores the user''s CD collection.';

-- 1. Enable Row Level Security (RLS) on the table
ALTER TABLE public.cds ENABLE ROW LEVEL SECURITY;

-- 2. Create a policy that allows users to view their own CDs
CREATE POLICY "Enable read access for own items" ON public.cds
FOR SELECT USING (auth.uid() = user_id);

-- 3. Create a policy that allows users to add their own CDs
CREATE POLICY "Enable insert for own items" ON public.cds
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Create a policy that allows users to update their own CDs
CREATE POLICY "Enable update for own items" ON public.cds
FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create a policy that allows users to delete their own CDs
CREATE POLICY "Enable delete for own items" ON public.cds
FOR DELETE USING (auth.uid() = user_id);
```

## 2. Wantlist Table (FIX)

The error `Could not find the table 'public.wantlist'` indicates this table is missing. Please run the following script to create it and set up its security policies.

```sql
-- Create the table for the user's wantlist
CREATE TABLE public.wantlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  notes text NULL,
  coverArtUrl text NULL,
  CONSTRAINT wantlist_pkey PRIMARY KEY (id),
  CONSTRAINT wantlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add comments for clarity
COMMENT ON TABLE public.wantlist IS 'Stores items users want to add to their collection.';

-- 1. Enable Row Level Security (RLS) on the table
ALTER TABLE public.wantlist ENABLE ROW LEVEL SECURITY;

-- 2. Create a policy that allows users to view their own wantlist items
CREATE POLICY "Enable read access for own wantlist items" ON public.wantlist
FOR SELECT USING (auth.uid() = user_id);

-- 3. Create a policy that allows users to add their own wantlist items
CREATE POLICY "Enable insert for own wantlist items" ON public.wantlist
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Create a policy that allows users to update their own wantlist items
CREATE POLICY "Enable update for own wantlist items" ON public.wantlist
FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create a policy that allows users to delete their own wantlist items
CREATE POLICY "Enable delete for own wantlist items" ON public.wantlist
FOR DELETE USING (auth.uid() = user_id);
```

After running these scripts, the sync errors related to missing tables should be resolved.
