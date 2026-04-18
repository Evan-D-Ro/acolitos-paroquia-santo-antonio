import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Acolyte } from '@/types/schedule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

interface AcolyteManagerProps {
  acolytes: Acolyte[];
  onRefresh: () => void;
}

export default function AcolyteManager({ acolytes, onRefresh }: AcolyteManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const addAcolyte = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('acolytes').insert({ name: newName.trim() });
    if (error) {
      toast.error('Erro ao adicionar acólito');
      return;
    }
    setNewName('');
    toast.success('Acólito adicionado');
    onRefresh();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('acolytes').update({ active: !active }).eq('id', id);
    onRefresh();
  };

  const toggleVacation = async (id: string, current: boolean) => {
    await supabase.from('acolytes').update({ vacation_only: !current }).eq('id', id);
    onRefresh();
  };

  const deleteAcolyte = async (id: string) => {
    if (!confirm('Remover este acólito?')) return;
    await supabase.from('acolytes').delete().eq('id', id);
    toast.success('Acólito removido');
    onRefresh();
  };

  const startEdit = (a: Acolyte) => {
    setEditingId(a.id);
    setEditName(a.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await supabase.from('acolytes').update({ name: editName.trim() }).eq('id', editingId);
    setEditingId(null);
    toast.success('Nome atualizado');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-heading font-semibold text-lg">Acólitos</h3>

      <div className="flex gap-2">
        <Input
          placeholder="Nome do acólito"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addAcolyte()}
        />
        <Button onClick={addAcolyte} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {acolytes.map(a => (
          <div
            key={a.id}
            className={`flex items-center gap-3 py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors ${
              !a.active ? 'opacity-50' : ''
            }`}
          >
            {editingId === a.id ? (
              <>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-8 text-sm flex-1"
                  onKeyDown={e => e.key === 'Enter' && saveEdit()}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${!a.active ? 'line-through' : ''}`}>
                  {a.name}
                  {a.vacation_only && (
                    <span className="ml-2 text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">férias</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(a)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleActive(a.id, a.active)}
                    title={a.active ? 'Desativar' : 'Ativar'}
                  >
                    <span className={`w-2 h-2 rounded-full ${a.active ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAcolyte(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
