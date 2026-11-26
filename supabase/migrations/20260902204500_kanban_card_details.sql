-- Trello-style details associated with a card. Every row is scoped through
-- its board/card parent so it inherits the existing workspace access model.
CREATE TABLE IF NOT EXISTS public.kanban_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  color text NOT NULL DEFAULT 'neutral',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, name)
);

CREATE TABLE IF NOT EXISTS public.kanban_card_labels (
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.kanban_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE IF NOT EXISTS public.kanban_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Checklist' CHECK (char_length(trim(title)) > 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanban_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.kanban_checklists(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0),
  is_complete boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kanban_labels_board_idx ON public.kanban_labels(board_id, position);
CREATE INDEX IF NOT EXISTS kanban_card_labels_card_idx ON public.kanban_card_labels(card_id);
CREATE INDEX IF NOT EXISTS kanban_checklists_card_idx ON public.kanban_checklists(card_id, position);
CREATE INDEX IF NOT EXISTS kanban_checklist_items_checklist_idx ON public.kanban_checklist_items(checklist_id, position);

ALTER TABLE public.kanban_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY kanban_labels_access ON public.kanban_labels FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_boards board
    WHERE board.id = board_id AND public.can_access_kanban_workspace(board.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_boards board
    WHERE board.id = board_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));

CREATE POLICY kanban_card_labels_access ON public.kanban_card_labels FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_cards card
    JOIN public.kanban_lists list ON list.id = card.list_id
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE card.id = card_id AND public.can_access_kanban_workspace(board.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_cards card
    JOIN public.kanban_lists list ON list.id = card.list_id
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE card.id = card_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));

CREATE POLICY kanban_checklists_access ON public.kanban_checklists FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_cards card
    JOIN public.kanban_lists list ON list.id = card.list_id
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE card.id = card_id AND public.can_access_kanban_workspace(board.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_cards card
    JOIN public.kanban_lists list ON list.id = card.list_id
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE card.id = card_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));

CREATE POLICY kanban_checklist_items_access ON public.kanban_checklist_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kanban_checklists checklist
    JOIN public.kanban_cards card ON card.id = checklist.card_id
    JOIN public.kanban_lists list ON list.id = card.list_id
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE checklist.id = checklist_id AND public.can_access_kanban_workspace(board.workspace_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kanban_checklists checklist
    JOIN public.kanban_cards card ON card.id = checklist.card_id
    JOIN public.kanban_lists list ON list.id = card.list_id
    JOIN public.kanban_boards board ON board.id = list.board_id
    WHERE checklist.id = checklist_id AND public.can_access_kanban_workspace(board.workspace_id)
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_labels, public.kanban_card_labels, public.kanban_checklists, public.kanban_checklist_items TO authenticated;
