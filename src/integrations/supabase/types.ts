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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      capture_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_sessions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          available_qty: number | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          moq: number | null
          product_id: string
          publish_status: Database["public"]["Enums"]["listing_publish_status"]
          supplier_id: string
          supplier_price_rmb: number | null
          updated_at: string
        }
        Insert: {
          available_qty?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          moq?: number | null
          product_id: string
          publish_status?: Database["public"]["Enums"]["listing_publish_status"]
          supplier_id: string
          supplier_price_rmb?: number | null
          updated_at?: string
        }
        Update: {
          available_qty?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          moq?: number | null
          product_id?: string
          publish_status?: Database["public"]["Enums"]["listing_publish_status"]
          supplier_id?: string
          supplier_price_rmb?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colours: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_colours_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          colour_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          product_id: string
          sort_order: number
          storage_path: string
          url: string
        }
        Insert: {
          colour_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          product_id: string
          sort_order?: number
          storage_path: string
          url: string
        }
        Update: {
          colour_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          product_id?: string
          sort_order?: number
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_colour_id_fkey"
            columns: ["colour_id"]
            isOneToOne: false
            referencedRelation: "product_colours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          id: string
          product_id: string
          size: string
          sort_order: number
        }
        Insert: {
          id?: string
          product_id: string
          size: string
          sort_order?: number
        }
        Update: {
          id?: string
          product_id?: string
          size?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          capture_session_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          discovery_date: string
          id: string
          internal_code: string
          material: string | null
          name: string
          status: Database["public"]["Enums"]["product_status"]
          supplier_id: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          capture_session_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_date?: string
          id?: string
          internal_code?: string
          material?: string | null
          name: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          capture_session_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_date?: string
          id?: string
          internal_code?: string
          material?: string | null
          name?: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_capture_session_id_fkey"
            columns: ["capture_session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          booth: string | null
          building: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          floor: string | null
          id: string
          market: string | null
          name: string
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["supplier_status"]
          updated_at: string
          wechat: string | null
        }
        Insert: {
          booth?: string | null
          building?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          market?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          wechat?: string | null
        }
        Update: {
          booth?: string | null
          building?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          market?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          wechat?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      listing_publish_status: "draft" | "published" | "archived"
      media_kind: "photo" | "video"
      product_status:
        | "discovered"
        | "watchlist"
        | "draft"
        | "published"
        | "archived"
      session_status: "active" | "ended"
      supplier_status: "active" | "inactive" | "blacklisted"
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
      listing_publish_status: ["draft", "published", "archived"],
      media_kind: ["photo", "video"],
      product_status: [
        "discovered",
        "watchlist",
        "draft",
        "published",
        "archived",
      ],
      session_status: ["active", "ended"],
      supplier_status: ["active", "inactive", "blacklisted"],
    },
  },
} as const
