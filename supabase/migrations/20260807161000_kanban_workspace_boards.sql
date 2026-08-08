-- Atualiza a primeira versão do Kanban, que armazenava workspace_id como
-- texto para suportar a área de compatibilidade (legacy-<user_id>).
-- Não convertemos a coluna para UUID para não tornar quadros legados
-- inacessíveis; o acesso é validado pela função abaixo.
ALTER TABLE IF EXISTS public.kanban_boards
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.kanban_cards
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'none';

ALTER TABLE IF EXISTS public.kanban_cards
  DROP CONSTRAINT IF EXISTS kanban_cards_priority_check;
ALTER TABLE IF EXISTS public.kanban_cards
  ADD CONSTRAINT kanban_cards_priority_check CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent'));

CREATE INDEX IF NOT EXISTS kanban_boards_workspace_idx ON public.kanban_boards(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kanban_lists_board_idx ON public.kanban_lists(board_id, position);
CREATE INDEX IF NOT EXISTS kanban_cards_list_idx ON public.kanban_cards(list_id, position);

CREATE OR REPLACE FUNCTION public.can_access_kanban_workspace(_workspace_id text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _workspace_id = concat('legacy-', _user_id::text)
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members member
      WHERE member.workspace_id::text = _workspace_id
        AND member.user_id = _user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_kanban_workspace(text, uuid) TO authenticated;

ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- Remove a política original que deixava qualquer usuário autenticado acessar
-- todos os quadros, inclusive os de outros workspaces.
DROP POLICY IF EXISTS "Users can manage kanban boards" ON public.kanban_boards;
DROP POLICY IF EXISTS "Users can manage kanban lists" ON public.kanban_lists;
DROP POLICY IF EXISTS "Users can manage kanban cards" ON public.kanban_cards;
DROP POLICY IF EXISTS kanban_boards_select ON public.kanban_boards;
DROP POLICY IF EXISTS kanban_boards_write ON public.kanban_boards;
DROP POLICY IF EXISTS kanban_lists_select ON public.kanban_lists;
DROP POLICY IF EXISTS kanban_lists_write ON public.kanban_lists;
DROP POLICY IF EXISTS kanban_cards_select ON public.kanban_cards;
DROP POLICY IF EXISTS kanban_cards_write ON public.kanban_cards;

CREATE POLICY kanban_boards_select ON public.kanban_boards FOR SELECT TO authenticated
  USING (public.can_access_kanban_workspace(workspace_id));
CREATE POLICY kanban_boards_write ON public.kanban_boards FOR ALL TO authenticated
  USING (public.can_access_kanban_workspace(workspace_id))
  WITH CHECK (public.can_access_kanban_workspace(workspace_id));

CREATE POLICY kanban_lists_select ON public.kanban_lists FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_boards board
    WHERE board.id = board_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));
CREATE POLICY kanban_lists_write ON public.kanban_lists FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_boards board
    WHERE board.id = board_id AND public.can_access_kanban_workspace(board.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_boards board
    WHERE board.id = board_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));

CREATE POLICY kanban_cards_select ON public.kanban_cards FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.kanban_lists list
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE list.id = list_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));
CREATE POLICY kanban_cards_write ON public.kanban_cards FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.kanban_lists list
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE list.id = list_id AND public.can_access_kanban_workspace(board.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.kanban_lists list
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE list.id = list_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));
