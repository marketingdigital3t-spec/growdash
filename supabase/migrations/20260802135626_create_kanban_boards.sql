-- Create kanban boards table
CREATE TABLE IF NOT EXISTS public.kanban_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create kanban lists (columns) table
CREATE TABLE IF NOT EXISTS public.kanban_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES public.kanban_boards(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create kanban cards table
CREATE TABLE IF NOT EXISTS public.kanban_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES public.kanban_lists(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Creation of security policies
CREATE POLICY "Users can manage kanban boards" ON public.kanban_boards
  FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can manage kanban lists" ON public.kanban_lists
  FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can manage kanban cards" ON public.kanban_cards
  FOR ALL TO authenticated USING (true);

-- Grant privileges
GRANT ALL ON public.kanban_boards TO authenticated, service_role;
GRANT ALL ON public.kanban_lists TO authenticated, service_role;
GRANT ALL ON public.kanban_cards TO authenticated, service_role;
