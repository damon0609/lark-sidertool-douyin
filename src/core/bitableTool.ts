import { bitable, ITable, FieldType, IFieldConfig } from '@lark-base-open/js-sdk';

interface TableInfo {
  id: string;
  name: string;
}

let cachedTables: TableInfo[] | null = null;

export async function getTableList(): Promise<TableInfo[]> {
  if (cachedTables) {
    return cachedTables;
  }

  try {
    const tables: ITable[] = await bitable.base.getTableList();
    
    const tableInfoList: TableInfo[] = [];
    
    for (const table of tables) {
      const name = await table.getName();
      tableInfoList.push({
        id: table.id,
        name: name
      });
    }
    
    cachedTables = tableInfoList;
    return cachedTables;
  } catch (error) {
    console.error('获取表格列表失败:', error);
    throw error;
  }
}

export async function checkTableExists(tableName: string): Promise<TableInfo | null> {
  const tables = await getTableList();
  return tables.find(table => table.name === tableName) || null;
}

export async function getOrCreateCollectionTable(tableName: string): Promise<ITable> {
  const existingTable = await checkTableExists(tableName);
  
  if (existingTable) {
    return bitable.base.getTableById(existingTable.id);
  }
  
  const fields: IFieldConfig[] = [
    {
      type: FieldType.DateTime,
      name: '添加时间',
      property: {
        dateFormat: 'yyyy/MM/dd HH:mm' as any,
        autoFill: true
      }
    },
    {
      type: FieldType.Text,
      name: '账号名称'
    },
    {
      type: FieldType.Text,
      name: '抖音号'
    },
    {
      type: FieldType.Text,
      name: '签名'
    },
    {
      type: FieldType.Text,
      name: '性别'
    },
    {
      type: FieldType.Number,
      name: '获赞'
    },
    {
      type: FieldType.Number,
      name: '粉丝量'
    },
    {
      type: FieldType.Number,
      name: '作品数量'
    },
    {
      type: FieldType.Url,
      name: '账号主页链接'
    },
    {
      type: FieldType.Attachment,
      name: '作品'
    },
    {
      type: FieldType.SingleSelect,
      name: '赛道',
      property: {
        options: [
          { name: '知识分享', color: 0 },
          { name: '搞笑娱乐', color: 1 },
          { name: '生活记录', color: 2 },
          { name: '美食', color: 3 },
          { name: '旅行', color: 4 },
          { name: '音乐', color: 5 },
          { name: '舞蹈', color: 6 },
          { name: '游戏', color: 7 },
          { name: '时尚', color: 8 },
          { name: '运动', color: 9 },
          { name: '萌宠', color: 10 },
          { name: '其他', color: 11 }
        ]
      }
    }
  ];

  try {
    const result = await bitable.base.addTable({
      name: tableName,
      fields: fields
    });
    
    clearCache();
    
    return bitable.base.getTableById(result.tableId);
  } catch (error) {
    console.error('创建采集表失败:', error);
    throw error;
  }
}

export function clearCache(): void {
  cachedTables = null;
}

export { bitable };
export type { ITable, TableInfo };
