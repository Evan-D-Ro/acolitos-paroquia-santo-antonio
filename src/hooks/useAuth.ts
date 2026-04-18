import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = async (u: User | null) => {
    if (!u) {
      setIsAdmin(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: u.id,
        _role: "admin",
      });

      if (error) {
        console.error(error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        console.log("1. Iniciando busca de sessão...");

        // Adicionamos um timeout ou verificamos se o supabase existe
        if (!supabase.auth) {
          throw new Error("Supabase auth não inicializado");
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Erro na sessão:", error);
          throw error;
        }

        const u = data.session?.user ?? null;
        console.log("2. Usuário encontrado:", u?.email || "Nenhum");

        if (!isMounted) return;

        setUser(u);

        if (u) {
          console.log("3. Verificando se é admin...");
          await checkAdmin(u);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Falha crítica no init:", err);
        // Se der erro, precisamos garantir que o sistema não trave no loading
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          console.log("4. Finalizou tudo, setando loading como false");
          setLoading(false);
        }
      }
    };

    init();

    // 👇 listener NÃO controla loading
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;

      if (!isMounted) return;

      setUser(u);
      await checkAdmin(u);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, isAdmin, loading, signIn, signOut };
}
