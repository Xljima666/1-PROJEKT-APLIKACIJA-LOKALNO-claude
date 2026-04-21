export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          board_id: string | null
          card_id: string | null
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          board_id?: string | null
          card_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_boards: {
        Row: {
          archived_at: string
          archived_by: string | null
          background_color: string | null
          created_by: string | null
          description: string | null
          id: string
          original_created_at: string | null
          original_id: string
          title: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          background_color?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          original_created_at?: string | null
          original_id: string
          title: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          background_color?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          original_created_at?: string | null
          original_id?: string
          title?: string
        }
        Relationships: []
      }
      archived_cards: {
        Row: {
          archived_at: string
          archived_by: string | null
          board_id: string | null
          board_title: string | null
          column_title: string | null
          created_by: string | null
          description: string | null
          id: string
          original_created_at: string | null
          original_id: string
          title: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          board_id?: string | null
          board_title?: string | null
          column_title?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          original_created_at?: string | null
          original_id: string
          title: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          board_id?: string | null
          board_title?: string | null
          column_title?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          original_created_at?: string | null
          original_id?: string
          title?: string
        }
        Relationships: []
      }
      archived_columns: {
        Row: {
          archived_at: string
          archived_by: string | null
          board_id: string | null
          board_title: string | null
          id: string
          original_created_at: string | null
          original_id: string
          position: number | null
          title: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          board_id?: string | null
          board_title?: string | null
          id?: string
          original_created_at?: string | null
          original_id: string
          position?: number | null
          title: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          board_id?: string | null
          board_title?: string | null
          id?: string
          original_created_at?: string | null
          original_id?: string
          position?: number | null
          title?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          card_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          background_color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          position: number | null
          title: string
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          position?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          position: number
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          position?: number
          start_time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          position?: number
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_labels: {
        Row: {
          card_id: string
          label_id: string
        }
        Insert: {
          card_id: string
          label_id: string
        }
        Update: {
          card_id?: string
          label_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_labels_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          adresa_cestice: string | null
          assigned_to: string | null
          color: string | null
          column_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          katastarska_cestica: string | null
          katastarska_opcina: string | null
          kontakt: string | null
          narucitelj_adresa: string | null
          narucitelj_ime: string | null
          narucitelj_oib: string | null
          parent_card_id: string | null
          position: number
          postanski_broj: string | null
          status: string | null
          title: string
          updated_at: string
          vrsta_posla: string[] | null
        }
        Insert: {
          adresa_cestice?: string | null
          assigned_to?: string | null
          color?: string | null
          column_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          katastarska_cestica?: string | null
          katastarska_opcina?: string | null
          kontakt?: string | null
          narucitelj_adresa?: string | null
          narucitelj_ime?: string | null
          narucitelj_oib?: string | null
          parent_card_id?: string | null
          position?: number
          postanski_broj?: string | null
          status?: string | null
          title: string
          updated_at?: string
          vrsta_posla?: string[] | null
        }
        Update: {
          adresa_cestice?: string | null
          assigned_to?: string | null
          color?: string | null
          column_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          katastarska_cestica?: string | null
          katastarska_opcina?: string | null
          kontakt?: string | null
          narucitelj_adresa?: string | null
          narucitelj_ime?: string | null
          narucitelj_oib?: string | null
          parent_card_id?: string | null
          position?: number
          postanski_broj?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          vrsta_posla?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_parent_card_id_fkey"
            columns: ["parent_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      columns: {
        Row: {
          board_id: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          card_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          ai_budget_usd: number | null
          ai_credits_remaining: number | null
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          oib: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          ai_budget_usd?: number | null
          ai_credits_remaining?: number | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          oib?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          ai_budget_usd?: number | null
          ai_credits_remaining?: number | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          oib?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      google_brain_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_name: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number | null
          total: number
          type: string
          updated_at: string
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number | null
          total?: number
          type: string
          updated_at?: string
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number | null
          total?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          board_id: string | null
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          board_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          board_id?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_nonces: {
        Row: {
          created_at: string
          id: string
          nonce: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nonce: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nonce?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          id: string
          position: number
          price: number
          quantity: number
          quote_id: string
          tax_rate: number
          total: number
          unit: string
        }
        Insert: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          position?: number
          price?: number
          quantity?: number
          quote_id: string
          tax_rate?: number
          total?: number
          unit?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          position?: number
          price?: number
          quantity?: number
          quote_id?: string
          tax_rate?: number
          total?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          address: string | null
          amount: number
          client_name: string
          client_type: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          oib: string | null
          quote_date: string
          quote_number: string
          status: string
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          address?: string | null
          amount?: number
          client_name: string
          client_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          oib?: string | null
          quote_date?: string
          quote_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          address?: string | null
          amount?: number
          client_name?: string
          client_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          oib?: string | null
          quote_date?: string
          quote_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      sdge_notifications: {
        Row: {
          calendar_event_id: string | null
          created_at: string
          description: string | null
          elaborat_number: string | null
          event_date: string | null
          event_type: string
          id: string
          raw_data: Json | null
          sdge_id: string
          synced_to_calendar: boolean
          title: string
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string
          description?: string | null
          elaborat_number?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          raw_data?: Json | null
          sdge_id: string
          synced_to_calendar?: boolean
          title: string
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string
          description?: string | null
          elaborat_number?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          raw_data?: Json | null
          sdge_id?: string
          synced_to_calendar?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdge_notifications_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          total_tokens: number
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          total_tokens?: number
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          total_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string
          id: string
          key_category: string
          key_label: string | null
          key_name: string
          key_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_category?: string
          key_label?: string | null
          key_name: string
          key_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_category?: string
          key_label?: string | null
          key_name?: string
          key_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tab_permissions: {
        Row: {
          created_at: string
          id: string
          tab_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tab_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tab_key?: string
          user_id?: string
        }
        Relationships: []
      }
      tab_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          granted_by: string | null
          id: string
          tab_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          granted_by?: string | null
          id?: string
          tab_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          granted_by?: string | null
          id?: string
          tab_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_order_items: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          id: string
          position: number
          price: number
          quantity: number
          tax_rate: number
          total: number
          unit: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          position?: number
          price?: number
          quantity?: number
          tax_rate?: number
          total?: number
          unit?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          position?: number
          price?: number
          quantity?: number
          tax_rate?: number
          total?: number
          unit?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          address: string | null
          amount: number
          client_name: string
          client_type: string
          created_at: string
          created_by: string | null
          currency: string
          fault_description: string | null
          hide_amounts: boolean
          id: string
          oib: string | null
          order_date: string
          order_number: string
          status: string
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
          work_description: string | null
          worker_name: string | null
        }
        Insert: {
          address?: string | null
          amount?: number
          client_name: string
          client_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          fault_description?: string | null
          hide_amounts?: boolean
          id?: string
          oib?: string | null
          order_date?: string
          order_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          work_description?: string | null
          worker_name?: string | null
        }
        Update: {
          address?: string | null
          amount?: number
          client_name?: string
          client_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          fault_description?: string | null
          hide_amounts?: boolean
          id?: string
          oib?: string | null
          order_date?: string
          order_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          work_description?: string | null
          worker_name?: string | null
        }
        Relationships: []
      }
      workspace_items: {
        Row: {
          archived: boolean
          completed: boolean
          created_at: string
          id: string
          is_private: boolean
          position: number
          saved_to_card_id: string | null
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          is_private?: boolean
          position?: number
          saved_to_card_id?: string | null
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          is_private?: boolean
          position?: number
          saved_to_card_id?: string | null
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_items_saved_to_card_id_fkey"
            columns: ["saved_to_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string }
        Returns: Json
      }
      cleanup_expired_nonces: { Args: never; Returns: undefined }
      get_org_admin: {
        Args: { uid: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tab_permission: {
        Args: { _tab_key: string; _user_id: string }
        Returns: boolean
      }
      is_admin: {
        Args: { uid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "korisnik"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
