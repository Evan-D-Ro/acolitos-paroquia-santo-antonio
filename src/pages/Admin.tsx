import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom"; // <-- Importamos o useNavigate
import { supabase } from "@/integrations/supabase/client";
import {
  Acolyte,
  ScheduleData,
  VariableRule,
  MONTH_NAMES,
  RuleViolation,
} from "@/types/schedule";
import { generateSchedule, validateSchedule } from "@/lib/schedule-engine";
import AcolyteManager from "@/components/AcolyteManager";
import RuleManager from "@/components/RuleManager";
import ScheduleEditor from "@/components/ScheduleEditor";
import ScheduleView from "@/components/ScheduleView";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  LogOut,
  RefreshCw,
  Save,
  Eye,
  Edit2,
  AlertTriangle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Admin() {
  const navigate = useNavigate();

  // Estados de Autenticação (Tudo direto no componente agora)
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estados da Escala
  const [acolytes, setAcolytes] = useState<Acolyte[]>([]);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<string>("draft");
  const [variableRules, setVariableRules] = useState<VariableRule[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [isVacation, setIsVacation] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [tab, setTab] = useState<"schedule" | "acolytes" | "rules">("schedule");

  // Funções de carregamento
  const loadAcolytes = useCallback(async () => {
    const { data } = await supabase.from("acolytes").select("*").order("name");
    if (data) setAcolytes(data);
  }, []);

  const loadSchedule = useCallback(async () => {
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (data) {
      setScheduleId(data.id);
      setScheduleData(data.data as unknown as ScheduleData);
      setScheduleStatus(data.status);
    } else {
      setScheduleId(null);
      setScheduleData(null);
      setScheduleStatus("draft");
    }
  }, [month, year]);

  const loadRules = useCallback(async () => {
    if (!scheduleId) {
      setVariableRules([]);
      return;
    }
    const { data } = await supabase
      .from("variable_rules")
      .select("*")
      .eq("schedule_id", scheduleId);
    if (data) setVariableRules(data as unknown as VariableRule[]);
  }, [scheduleId]);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Pega a sessão
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Se não tiver logado, chuta pra fora (Ajuste a rota se seu login for em outro lugar)
      if (!session) {
        navigate("/");
        return;
      }

      // 2. Verifica se é admin (Já que no de acólitos você precisa dessa regra)
      const { data: isUserAdmin } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });

      if (!isUserAdmin) {
        setIsAdmin(false);
        setLoading(false);
        return; // Para aqui, não carrega os acólitos
      }

      // 3. Deu tudo certo! Salva os dados e carrega o sistema
      setUser(session.user);
      setIsAdmin(true);
      loadAcolytes();
      loadSchedule();
      setLoading(false);
    };

    checkAuth();
  }, [navigate, loadAcolytes, loadSchedule]); // Recarrega se mês/ano mudar

  // Carrega regras sempre que o scheduleId mudar
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Validação de regras da escala
  useEffect(() => {
    if (scheduleData && acolytes.length > 0) {
      const v = validateSchedule(
        scheduleData,
        acolytes,
        variableRules,
        isVacation,
      );
      setViolations(v);
    } else {
      setViolations([]);
    }
  }, [scheduleData, acolytes, variableRules, isVacation]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/"); // Chuta pra home após sair
  };

  const handleGenerate = async () => {
    const data = generateSchedule(
      year,
      month,
      acolytes,
      variableRules,
      isVacation,
    );
    setScheduleData(data);

    // Upsert schedule
    if (scheduleId) {
      await supabase
        .from("schedules")
        .update({ data: data as any })
        .eq("id", scheduleId);
    } else {
      const { data: newSched } = await supabase
        .from("schedules")
        .insert([{ month, year, data: data as any, status: "draft" }] as any)
        .select()
        .single();
      if (newSched) setScheduleId(newSched.id);
    }

    toast.success("Escala gerada com sucesso!");
  };

  const handleSave = async () => {
    if (!scheduleId || !scheduleData) return;
    await supabase
      .from("schedules")
      .update({ data: scheduleData as any })
      .eq("id", scheduleId);
    toast.success("Escala salva");
  };

  const handlePublish = async () => {
    if (!scheduleId) return;
    const newStatus = scheduleStatus === "published" ? "draft" : "published";
    await supabase
      .from("schedules")
      .update({ status: newStatus })
      .eq("id", scheduleId);
    setScheduleStatus(newStatus);
    toast.success(
      newStatus === "published" ? "Escala publicada!" : "Escala despublicada",
    );
  };

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setMonth(m);
    setYear(y);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-xl font-semibold">
          Você não tem permissão de administrador.
        </p>
        <Link to="/" className="text-accent underline">
          Voltar para Home
        </Link>
      </div>
    );
  }

  const errors = violations.filter((v) => v.type === "error");
  const warnings = violations.filter((v) => v.type === "warning");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Voltar
            </Link>
            <h1 className="font-heading font-semibold text-lg">Painel Admin</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {(["schedule", "acolytes", "rules"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "schedule"
                ? "Escala"
                : t === "acolytes"
                  ? "Acólitos"
                  : "Regras"}
            </button>
          ))}
        </div>

        {tab === "acolytes" && (
          <AcolyteManager acolytes={acolytes} onRefresh={loadAcolytes} />
        )}

        {tab === "rules" &&
          (scheduleId ? (
            <RuleManager
              scheduleId={scheduleId}
              acolytes={acolytes}
              rules={variableRules}
              onRefresh={loadRules}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Gere uma escala primeiro para adicionar regras variáveis.</p>
            </div>
          ))}

        {tab === "schedule" && (
          <div className="space-y-4">
            {/* Month selector + actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-heading font-semibold text-lg min-w-[160px] text-center">
                  {MONTH_NAMES[month - 1]} {year}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => changeMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* <div className="flex items-center gap-2">
                <Checkbox
                  id="vacation"
                  checked={isVacation}
                  onCheckedChange={(v) => setIsVacation(!!v)}
                />
                <Label htmlFor="vacation" className="text-sm">
                  Período de férias
                </Label>
              </div> */}

              <div className="flex gap-2 ml-auto">
                <Button onClick={handleGenerate} size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" /> Gerar
                </Button>
                {scheduleData && (
                  <>
                    <Button onClick={handleSave} variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                    <Button
                      onClick={() =>
                        setViewMode((v) => (v === "edit" ? "preview" : "edit"))
                      }
                      variant="outline"
                      size="sm"
                    >
                      {viewMode === "edit" ? (
                        <Eye className="h-4 w-4 mr-1" />
                      ) : (
                        <Edit2 className="h-4 w-4 mr-1" />
                      )}
                      {viewMode === "edit" ? "Preview" : "Editar"}
                    </Button>
                    <Button
                      onClick={handlePublish}
                      variant={
                        scheduleStatus === "published"
                          ? "destructive"
                          : "default"
                      }
                      size="sm"
                    >
                      {scheduleStatus === "published"
                        ? "Despublicar"
                        : "Publicar"}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Violations */}
            {violations.length > 0 && (
              <div className="space-y-1">
                {errors.map((v, i) => (
                  <div
                    key={`e-${i}`}
                    className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {v.message}
                  </div>
                ))}
                {warnings.map((v, i) => (
                  <div
                    key={`w-${i}`}
                    className="flex items-start gap-2 text-sm text-accent bg-accent/10 px-3 py-2 rounded"
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    {v.message}
                  </div>
                ))}
              </div>
            )}

            {/* Schedule content */}
            {scheduleData ? (
              viewMode === "edit" ? (
                <ScheduleEditor
                  data={scheduleData}
                  acolytes={acolytes}
                  onChange={setScheduleData}
                />
              ) : (
                <ScheduleView
                  data={scheduleData}
                  month={month}
                  year={year}
                  acolytes={acolytes}
                />
              )
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-lg">
                  Nenhuma escala para {MONTH_NAMES[month - 1]} {year}
                </p>
                <p className="text-sm mt-1">
                  Clique em "Gerar" para criar uma nova escala
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
