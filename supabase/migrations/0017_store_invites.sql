-- Migration: Create store_invites table for Phase 13
-- 0017_store_invites.sql

CREATE TABLE IF NOT EXISTS public.store_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'sales_agent',
    custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL,
    token UUID NOT NULL DEFAULT gen_random_uuid(),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    
    -- Ensure unique pending invite per email per store
    UNIQUE(seller_id, email, status)
);

-- RLS
ALTER TABLE public.store_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Owners can view/create invites for their store
CREATE POLICY "Owners can manage invites" 
ON public.store_invites
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.store_members
        WHERE store_members.seller_id = store_invites.seller_id
        AND store_members.user_id = auth.uid()
        AND store_members.role = 'owner'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.store_members
        WHERE store_members.seller_id = store_invites.seller_id
        AND store_members.user_id = auth.uid()
        AND store_members.role = 'owner'
    )
);

-- Policy: Invitees can view their own invite (by email)
CREATE POLICY "Users can view their own invites"
ON public.store_invites
FOR SELECT
TO authenticated
USING (
    email = auth.email()
);

-- Add comment
COMMENT ON TABLE public.store_invites IS 'Pending team member invitations for stores.';
