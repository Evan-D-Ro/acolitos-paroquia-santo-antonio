import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ScheduleView from "@/components/ScheduleView";
import { ScheduleData, MONTH_NAMES, Acolyte } from "@/types/schedule";
import { Link } from "react-router-dom";

export default function Index() {
  const [schedule, setSchedule] = useState<{
    data: ScheduleData;
    month: number;
    year: number;
  } | null>(null);
  const [acolytes, setAcolytes] = useState<Acolyte[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [schedRes, acoRes] = await Promise.all([
        supabase
          .from("schedules")
          .select("*")
          .eq("month", month)
          .eq("year", year)
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
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
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
          <div className="flex items-center justify-center min-h-[60vh]">
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
                A escala de {MONTH_NAMES[new Date().getMonth()]} ainda não foi
                publicada.
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
