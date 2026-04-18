import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Acolyte, VariableRule } from '@/types/schedule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface RuleManagerProps {
  scheduleId: string;
  acolytes: Acolyte[];
  rules: VariableRule[];
  onRefresh: () => void;
}

export default function RuleManager({ scheduleId, acolytes, rules, onRefresh }: RuleManagerProps) {
  const [ruleType, setRuleType] = useState<string>('unavailable_date');
  const [selectedAcolyte, setSelectedAcolyte] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const addRule = async () => {
    if (!selectedAcolyte) {
      toast.error('Selecione um acólito');
      return;
    }

    let ruleData: Record<string, unknown> = {};

    if (ruleType === 'unavailable_date') {
      if (!dateValue) {
        toast.error('Informe a data');
        return;
      }
      // Check if there's an existing unavailable_date rule for this acolyte
      const existing = rules.find(
        r => r.acolyte_id === selectedAcolyte && r.rule_type === 'unavailable_date'
      );
      if (existing) {
        const dates = [...(existing.rule_data.dates || []), dateValue];
        await supabase
          .from('variable_rules')
          .update({ rule_data: { dates } })
          .eq('id', existing.id);
        toast.success('Data adicionada');
        onRefresh();
        setDateValue('');
        return;
      }
      ruleData = { dates: [dateValue] };
    } else if (ruleType === 'max_assignments') {
      if (!maxValue) {
        toast.error('Informe o máximo');
        return;
      }
      ruleData = { max: parseInt(maxValue) };
    }

    const { error } = await supabase.from('variable_rules').insert([{
      schedule_id: scheduleId,
      acolyte_id: selectedAcolyte,
      rule_type: ruleType,
      rule_data: ruleData,
    }] as any);

    if (error) {
      toast.error('Erro ao adicionar regra');
      return;
    }

    toast.success('Regra adicionada');
    setDateValue('');
    setMaxValue('');
    onRefresh();
  };

  const deleteRule = async (id: string) => {
    await supabase.from('variable_rules').delete().eq('id', id);
    toast.success('Regra removida');
    onRefresh();
  };

  const getAcolyteName = (id: string) => acolytes.find(a => a.id === id)?.name || id;

  const formatRuleDescription = (rule: VariableRule) => {
    if (rule.rule_type === 'unavailable_date') {
      const dates = (rule.rule_data.dates || []).map((d: string) => {
        const dt = new Date(d + 'T12:00:00');
        return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}`;
      });
      return `Indisponível em: ${dates.join(', ')}`;
    }
    if (rule.rule_type === 'max_assignments') {
      return `Máximo de ${rule.rule_data.max} escalas`;
    }
    return rule.rule_data.description || 'Regra personalizada';
  };

  return (
    <div className="space-y-4">
      <h3 className="font-heading font-semibold text-lg">Regras Variáveis</h3>

      <div className="space-y-3 p-3 bg-secondary/30 rounded-md">
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedAcolyte} onValueChange={setSelectedAcolyte}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Acólito" />
            </SelectTrigger>
            <SelectContent>
              {acolytes.filter(a => a.active).map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={ruleType} onValueChange={setRuleType}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unavailable_date">Indisponível (data)</SelectItem>
              <SelectItem value="max_assignments">Máximo de escalas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ruleType === 'unavailable_date' && (
          <Input
            type="date"
            value={dateValue}
            onChange={e => setDateValue(e.target.value)}
            className="h-9 text-sm"
          />
        )}

        {ruleType === 'max_assignments' && (
          <Input
            type="number"
            min={0}
            placeholder="Máximo de vezes"
            value={maxValue}
            onChange={e => setMaxValue(e.target.value)}
            className="h-9 text-sm"
          />
        )}

        <Button onClick={addRule} size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Adicionar Regra
        </Button>
      </div>

      <div className="space-y-1">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra variável definida</p>
        )}
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-secondary/50">
            <div className="flex-1 text-sm">
              <span className="font-medium">{getAcolyteName(rule.acolyte_id)}</span>
              <span className="text-muted-foreground ml-2">{formatRuleDescription(rule)}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRule(rule.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
