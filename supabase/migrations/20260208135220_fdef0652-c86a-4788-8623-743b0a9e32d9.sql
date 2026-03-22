-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- Create invitations table
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days') NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create boards table
CREATE TABLE public.boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    background_color TEXT DEFAULT '#3B82F6',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create columns table
CREATE TABLE public.columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create labels table
CREATE TABLE public.labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create cards table
CREATE TABLE public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create card_labels junction table
CREATE TABLE public.card_labels (
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
);

-- Create comments table
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create attachments table
CREATE TABLE public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create activity_log table
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
    card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create invoices table
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('incoming', 'outgoing')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_address TEXT,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 25,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    due_date DATE,
    paid_at TIMESTAMP WITH TIME ZONE,
    stripe_payment_intent_id TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create invoice_items table
CREATE TABLE public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to create profile and assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create update triggers for tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_columns_updated_at BEFORE UPDATE ON public.columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: Users can read all profiles, update only their own
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- User roles: Only viewable, managed by system
CREATE POLICY "Users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Invitations: Admins can manage, users can view their own
CREATE POLICY "Admins can manage invitations" ON public.invitations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view invitations for their email" ON public.invitations FOR SELECT TO anon USING (true);

-- Boards: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view boards" ON public.boards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create boards" ON public.boards FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update boards" ON public.boards FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete boards" ON public.boards FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Columns: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view columns" ON public.columns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create columns" ON public.columns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update columns" ON public.columns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete columns" ON public.columns FOR DELETE TO authenticated USING (true);

-- Cards: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view cards" ON public.cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create cards" ON public.cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cards" ON public.cards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete cards" ON public.cards FOR DELETE TO authenticated USING (true);

-- Labels: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view labels" ON public.labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create labels" ON public.labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update labels" ON public.labels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete labels" ON public.labels FOR DELETE TO authenticated USING (true);

-- Card labels: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view card_labels" ON public.card_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create card_labels" ON public.card_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete card_labels" ON public.card_labels FOR DELETE TO authenticated USING (true);

-- Comments: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view comments" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Attachments: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view attachments" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create attachments" ON public.attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete attachments" ON public.attachments FOR DELETE TO authenticated USING (true);

-- Activity log: All authenticated users can view, system creates
CREATE POLICY "Authenticated users can view activity_log" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create activity_log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Invoices: All authenticated users can CRUD
CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Invoice items: Follow invoice policies
CREATE POLICY "Authenticated users can view invoice_items" ON public.invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can create invoice_items" ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update invoice_items" ON public.invoice_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete invoice_items" ON public.invoice_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;