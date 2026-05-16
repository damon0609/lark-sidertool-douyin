import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getTableList, TableInfo } from '../core/bitableTool';

interface BitableContextType {
  tables: TableInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const BitableContext = createContext<BitableContextType>({
  tables: [],
  loading: false,
  error: null,
  refresh: async () => {}
});

export function BitableProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const tableList = await getTableList();
      setTables(tableList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取表格列表失败');
      console.error('加载表格列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  return (
    <BitableContext.Provider value={{ tables, loading, error, refresh: loadTables }}>
      {children}
    </BitableContext.Provider>
  );
}

export function useBitable() {
  return useContext(BitableContext);
}
