-- Workspace Editors need to manage the manual participants that belong to a
-- class. The older policies only accepted the class owner or the legacy admin
-- role, so an Editor could open the page but every participant write failed at
-- the database boundary.

CREATE INDEX IF NOT EXISTS event_classes_user_idx
  ON public.event_classes (user_id);

CREATE INDEX IF NOT EXISTS workspace_members_user_status_idx
  ON public.workspace_members (user_id, status, workspace_id);

CREATE OR REPLACE FUNCTION public.user_can_edit_event_class_account(
  _ad_account_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ad_accounts account
    WHERE account.id = _ad_account_id
      AND (
        public.is_master(_user_id)
        OR public.has_role(_user_id, 'admin'::public.app_role)
        OR (
          account.workspace_id IS NOT NULL
          AND public.can_edit_workspace(account.workspace_id, _user_id)
        )
        OR (
          account.workspace_id IS NULL
          AND account.user_id = _user_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_edit_event_class_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_edit_event_class_account(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_can_access_event_class(
  _event_class_id uuid,
  _write boolean DEFAULT false,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_classes event_class
    WHERE event_class.id = _event_class_id
      AND (
        public.is_master(_user_id)
        OR public.has_role(_user_id, 'admin'::public.app_role)
        OR event_class.user_id = _user_id
        OR EXISTS (
          SELECT 1
          FROM (
            SELECT event_class.ad_account_id AS ad_account_id
            WHERE event_class.ad_account_id IS NOT NULL
            UNION
            SELECT link.ad_account_id
            FROM public.event_class_accounts link
            WHERE link.event_class_id = event_class.id
          ) linked_account
          WHERE CASE
            WHEN _write THEN public.user_can_edit_event_class_account(linked_account.ad_account_id, _user_id)
            ELSE public.user_can_view_ad_account(_user_id, linked_account.ad_account_id)
          END
        )
        OR EXISTS (
          SELECT 1
          FROM public.workspace_members owner_members
          WHERE owner_members.user_id = event_class.user_id
            AND owner_members.status = 'active'
            AND CASE
              WHEN _write THEN public.can_edit_workspace(owner_members.workspace_id, _user_id)
              ELSE public.is_workspace_member(owner_members.workspace_id, _user_id)
            END
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_event_class(uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_event_class(uuid, boolean, uuid) TO authenticated, service_role;

-- Replace the owner-only policies on the class and all dependent records.
DROP POLICY IF EXISTS "View event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Insert event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Update event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Delete event_classes" ON public.event_classes;
DROP POLICY IF EXISTS "Assigned users view event_classes" ON public.event_classes;

CREATE POLICY "Workspace members view event_classes"
  ON public.event_classes FOR SELECT TO authenticated
  USING ((SELECT public.user_can_access_event_class(id, false)));

CREATE POLICY "Workspace editors create event_classes"
  ON public.event_classes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      (SELECT auth.uid()) = user_id
      AND (
        ad_account_id IS NULL
        OR (SELECT public.user_can_edit_event_class_account(ad_account_id))
      )
    )
  );

CREATE POLICY "Workspace editors update event_classes"
  ON public.event_classes FOR UPDATE TO authenticated
  USING ((SELECT public.user_can_access_event_class(id, true)))
  WITH CHECK (
    public.is_master((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      (SELECT auth.uid()) = user_id
      AND (
        ad_account_id IS NULL
        OR (SELECT public.user_can_edit_event_class_account(ad_account_id))
      )
    )
    OR (
      ad_account_id IS NULL
      AND (SELECT public.user_can_access_event_class(id, true))
    )
    OR (
      ad_account_id IS NOT NULL
      AND (SELECT public.user_can_edit_event_class_account(ad_account_id))
    )
  );

CREATE POLICY "Workspace editors delete event_classes"
  ON public.event_classes FOR DELETE TO authenticated
  USING ((SELECT public.user_can_access_event_class(id, true)));

DROP POLICY IF EXISTS "event_class_participants_select" ON public.event_class_participants;
DROP POLICY IF EXISTS "event_class_participants_insert" ON public.event_class_participants;
DROP POLICY IF EXISTS "event_class_participants_update" ON public.event_class_participants;
DROP POLICY IF EXISTS "event_class_participants_delete" ON public.event_class_participants;

CREATE POLICY "Workspace members view event_class_participants"
  ON public.event_class_participants FOR SELECT TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, false)));

CREATE POLICY "Workspace editors create event_class_participants"
  ON public.event_class_participants FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

CREATE POLICY "Workspace editors update event_class_participants"
  ON public.event_class_participants FOR UPDATE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)))
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

CREATE POLICY "Workspace editors delete event_class_participants"
  ON public.event_class_participants FOR DELETE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)));

DROP POLICY IF EXISTS "View event_class_members" ON public.event_class_members;
DROP POLICY IF EXISTS "Insert event_class_members" ON public.event_class_members;
DROP POLICY IF EXISTS "Update event_class_members" ON public.event_class_members;
DROP POLICY IF EXISTS "Delete event_class_members" ON public.event_class_members;

CREATE POLICY "Workspace members view event_class_members"
  ON public.event_class_members FOR SELECT TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, false)));

CREATE POLICY "Workspace editors create event_class_members"
  ON public.event_class_members FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

CREATE POLICY "Workspace editors update event_class_members"
  ON public.event_class_members FOR UPDATE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)))
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

CREATE POLICY "Workspace editors delete event_class_members"
  ON public.event_class_members FOR DELETE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)));

DROP POLICY IF EXISTS "View event_class_history" ON public.event_class_history;
DROP POLICY IF EXISTS "Insert event_class_history" ON public.event_class_history;

CREATE POLICY "Workspace members view event_class_history"
  ON public.event_class_history FOR SELECT TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, false)));

CREATE POLICY "Workspace editors create event_class_history"
  ON public.event_class_history FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

DROP POLICY IF EXISTS "View event_class_sources" ON public.event_class_sources;
DROP POLICY IF EXISTS "Insert event_class_sources" ON public.event_class_sources;
DROP POLICY IF EXISTS "Update event_class_sources" ON public.event_class_sources;
DROP POLICY IF EXISTS "Delete event_class_sources" ON public.event_class_sources;

CREATE POLICY "Workspace members view event_class_sources"
  ON public.event_class_sources FOR SELECT TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, false)));

CREATE POLICY "Workspace editors create event_class_sources"
  ON public.event_class_sources FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

CREATE POLICY "Workspace editors update event_class_sources"
  ON public.event_class_sources FOR UPDATE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)))
  WITH CHECK ((SELECT public.user_can_access_event_class(event_class_id, true)));

CREATE POLICY "Workspace editors delete event_class_sources"
  ON public.event_class_sources FOR DELETE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)));

DROP POLICY IF EXISTS "View event_class_accounts" ON public.event_class_accounts;
DROP POLICY IF EXISTS "Insert event_class_accounts" ON public.event_class_accounts;
DROP POLICY IF EXISTS "Delete event_class_accounts" ON public.event_class_accounts;

CREATE POLICY "Workspace members view event_class_accounts"
  ON public.event_class_accounts FOR SELECT TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, false)));

CREATE POLICY "Workspace editors create event_class_accounts"
  ON public.event_class_accounts FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.user_can_access_event_class(event_class_id, true))
    AND (SELECT public.user_can_edit_event_class_account(ad_account_id))
  );

CREATE POLICY "Workspace editors delete event_class_accounts"
  ON public.event_class_accounts FOR DELETE TO authenticated
  USING ((SELECT public.user_can_access_event_class(event_class_id, true)));
