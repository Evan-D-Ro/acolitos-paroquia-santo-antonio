import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ScheduleView from "@/components/ScheduleView";
import { ScheduleData, MONTH_NAMES, Acolyte } from "@/types/schedule";
import { Link } from "react-router-dom";
import { Moon, Sun, ChevronLeft, ChevronRight } from "lucide-react";

export default function Index() {
  // Pegamos a data atual para iniciar os estados e servir de base para a trava
  const now = new Date();

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Estados para controlar o mês e ano que estamos visualizando na tela
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [viewYear, setViewYear] = useState(currentYear);

  const [schedule, setSchedule] = useState<{
    data: ScheduleData;
    month: number;
    year: number;
  } | null>(null);

  const [acolytes, setAcolytes] = useState<Acolyte[]>([]);
  const [loading, setLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    const root = document.documentElement;

    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [schedRes, acoRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("*")
          .eq("month", viewMonth)
          .eq("year", viewYear)
          .eq("status", "published")
          .maybeSingle(),
        supabase.from("acolytes").select("*").eq("active", true),
      ]);

      if (acoRes.data) setAcolytes(acoRes.data);

      if (schedRes.data) {
        setSchedule({
          data: schedRes.data.data as unknown as ScheduleData,
          month: schedRes.data.month,
          year: schedRes.data.year,
        });
      } else {
        setSchedule(null);
      }

      setLoading(false);
    }
    load();
  }, [viewMonth, viewYear]);

  // Lógica da trava: Desabilita se o ano que estamos vendo é menor que o atual,
  // OU se é o mesmo ano atual, mas o mês é menor ou igual ao atual.
  const isPrevDisabled =
    viewYear < currentYear ||
    (viewYear === currentYear && viewMonth <= currentMonth);

  const handlePrevMonth = () => {
    // Trava de segurança extra na função
    if (isPrevDisabled) return;

    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setDarkMode((prev) => !prev)}
          className="p-2 rounded-full bg-card border border-border shadow-sm hover:bg-muted transition"
        >
          {darkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center space-y-2">
          <div className="inline-block border-b-2 border-accent pb-2">
            <h1 className="text-2xl md:text-3xl font-heading font-semibold tracking-wide text-foreground">
              Escala de Acólitos
            </h1>
          </div>

          <div className="flex items-center justify-between mb-8 bg-card p-4 rounded-xl shadow-sm border border-border">
            {/* Botão Anterior alterado com a lógica de desabilitação e novos estilos */}
            <button
              onClick={handlePrevMonth}
              disabled={isPrevDisabled}
              className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-medium ${
                isPrevDisabled
                  ? "opacity-50 cursor-not-allowed text-muted-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <h2 className="text-xl font-heading font-semibold text-foreground text-center">
              {MONTH_NAMES[viewMonth - 1]} de {viewYear}
            </h2>

            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-muted rounded-full transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground pb-4">
            Paróquia Santo Antônio — Rancharia/SP
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm">
                Carregando escala...
              </p>
            </div>
          </div>
        ) : schedule ? (
          <ScheduleView
            data={schedule.data}
            month={schedule.month}
            year={schedule.year}
            acolytes={acolytes}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-secondary flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <h1 className="text-xl font-heading font-semibold text-foreground">
                Escala de Acólitos
              </h1>
              <p className="text-muted-foreground">
                Paróquia Santo Antônio — Rancharia/SP
              </p>
              <p className="text-sm text-muted-foreground">
                A escala de {MONTH_NAMES[viewMonth - 1]} de {viewYear} ainda não
                foi publicada.
              </p>
            </div>
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            Paróquia Santo Antônio — Rancharia/SP
          </p>
          <Link
            to="/auth"
            className="text-xs text-accent hover:underline mt-1 inline-block"
          >
            Área administrativa
          </Link>
        </footer>
      </div>
    </div>
  );
}
