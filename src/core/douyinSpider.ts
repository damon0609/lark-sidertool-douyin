import { bitable, checkers, FieldType, IField, IRecord, IRecordValue, ITable, ISingleSelectField } from "@lark-base-open/js-sdk";
import { getDouyinUserInfo, getDouyinWorkInfo, downloadVideo } from "./douyinServer";

export async function uploadFromUrl(url: string, fileName: string) {
    // 下载视频文件
    const file = await downloadVideo(url, fileName);
    return file;
}




export interface IProcessedRecord {
  recordId: string;
  url: string;
  isCollected: string;
}

export enum requestType {
  user_info = "user_info",
  work_info = "work_info",
  work_info_list = "work_info_list"
}

// 用户信息
export interface UserInfo {
  uid: number | string;
  user_id: string;
  user_name: string;
  followers_count: number;
  signature: string;
  total_favorited: number;
  follower_count: number;
  aweme_count: number;
  user_age: number;
  gender: "男" | "女";
  following_count: number;
  city: string;
  country: string;
  district: string;
  share_url: string;
}

// 单条作品
export interface WorkInfo {
  work_id: string;
  aweme_type: number;
  caption: string;
  work_create_time: number;
  play_addr?: string | string[];
}

// 作品列表
export type WorkList = WorkInfo[];

export function responseToData(
  response: Record<string, any> | any[],
  request_type: requestType
): UserInfo | WorkInfo | WorkList {
  if (request_type === requestType.user_info) {
    if (response && typeof response === "object" && !Array.isArray(response)) {
      const user = response["user"];
      const userInfo: UserInfo = {
        uid: user["uid"],
        user_id: user["unique_id"],
        user_name: user["nickname"],
        followers_count: user["mplatform_followers_count"],
        signature: user["signature"],
        total_favorited: user["total_favorited"],
        follower_count: user["follower_count"],
        aweme_count: user["aweme_count"],
        user_age: user["user_age"],
        gender: user["gender"] === 1 ? "男" : "女",
        following_count: user["following_count"],
        city: user["city"],
        country: user["country"],
        district: user["district"],
        share_url: user?.["share_info"]?.["share_url"] || "",
      };
      return userInfo;
    }
  }
  else if (request_type === requestType.work_info) {
    if (response && typeof response === "object" && !Array.isArray(response)) {
      const work = response["aweme_detail"];
      const workInfo: WorkInfo = {
        work_id: work["aweme_id"],
        aweme_type: work["aweme_type"],
        caption: work["caption"],
        work_create_time: work["create_time"],
      };
      const awemeType = workInfo["aweme_type"];
      if (awemeType === 0) {
        workInfo["play_addr"] = work?.["video"]?.["play_addr"]?.["url_list"]?.[2] || "";
      } else if (awemeType === 68) {
        workInfo["play_addr"] = work?.["images"]?.[0]?.["url_list"]?.[0] || "";
      }

      return workInfo;
    }
  }
  else if (request_type === requestType.work_info_list) {
    const workList: WorkList = [];
    if (Array.isArray(response)) {
      for (const item of response) {
        const awemeType = item.aweme_type;

        const data: WorkInfo = {
          work_id: item["aweme_id"],
          aweme_type: item["aweme_type"],
          caption: item["desc"],
          work_create_time: item["create_time"],
        };

        if (awemeType === 0) {
          data["play_addr"] = item?.["video"]?.["play_addr"]?.["url_list"]?.[0] || "";
        } else if (awemeType === 68) {
          data["play_addr"] = [];
          const images = item["images"] || [];
          for (const d of images) {
            data["play_addr"].push(d?.["url_list"]?.[0] || "");
          }
          console.log((data["play_addr"] as string[]).length);
        }

        workList.push(data);
      }
    }
    return workList;
  }
  else {
    throw new Error(`unknown request type: ${request_type}`);
  }

  throw new Error("invalid response");
}

export async function getUserInfo(userUrl: string) {
  try {
    if (!userUrl) {
      throw new Error('User URL cannot be empty');
    }
    userUrl = "https://www.douyin.com/user/MS4wLjABAAAANhsJkTNrtUXM_vhrvfGV4Aq91DVWNM2E-U3Ea4Om4yk?from_tab_name=main&modal_id=7603738287761377765&vid=7603738287761377765"
    const data = await getDouyinUserInfo(userUrl);
    const userInfo = responseToData(data, requestType.user_info);
    return userInfo;
  } catch (error) {
    console.error('Error getting Douyin user info:', error);
    throw error;
  }
}

export async function getWorkInfo(
  records: { url: string; isCollected: string,recordId: string }[],
  callback?: (data: {userUrl: string; index: number; record: string,workUrl: string }) => void
) {

  // 可以根据 isCollected 的值筛选出需要采集的记录
  const needCollectRecords = records.filter(record => record.isCollected !== '是');
  const needCollectUrls = needCollectRecords.map(record => record.url);
  
  // 遍历 needCollectUrls 数组
  for (let index = 0; index < needCollectUrls.length; index++) {
    const url = needCollectUrls[index];
    const workInfo = await getDouyinWorkInfo(url);
    const record = needCollectRecords[index].recordId;
    //作品链接
    if(workInfo){
      const workUrl= responseToData(workInfo, requestType.work_info)["play_addr"];
      const sec_uid = workInfo['aweme_detail']['author']['sec_uid'];
      const userUrl = `https://www.douyin.com/user/${sec_uid}?from_tab_name=main`;
      // 调用回调函数，传递获取到的数据
      if (callback) {
        callback({
          userUrl,
          index,
          record,
          workUrl,
        });
      }
    }
  }
}

export async function updateSingleRecord(table: ITable,isCollected_field: ISingleSelectField,recordId: string) {
  const options = await isCollected_field.getOptions();
  const targetOption = options.find((opt) => opt.name === "是");
  if (!targetOption?.id) {
    console.error("在该字段中找不到名为‘是’的选项");
    return;
  }
  await table.setRecord(recordId, {
    fields: {
      [isCollected_field.id]: {
        id: targetOption.id,
        text: targetOption.name,
      }
    }
  })
}

export async function updatePendingRecords(
  table: ITable,
  isCollected_field: ISingleSelectField,
  processedRecords: IProcessedRecord[]
) {
  if (processedRecords.length === 0) return;

  const options = await isCollected_field.getOptions();
  const targetOption = options.find((opt) => opt.name === "是");

  if (!targetOption?.id) {
    console.error("在该字段中找不到名为‘是’的选项");
    return;
  }
  for (const record of processedRecords) {
    await table.setRecord(record.recordId, {
      fields: {
        [isCollected_field.id]: {
          id: targetOption.id,
          text: targetOption.name,
        }
      }
    })
  }
}

export async function toBeCollectedRecords(tableName: string): Promise<{ allRecords: IRecord[]; table: ITable }> {

  //base指的是当前激活的app_token，表是指app_token下的table
  const table = await bitable.base.getTableByName(tableName);
  const allRecords: IRecord[] = [];
  let pageToken: number | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await table.getRecordsByPage({
      pageSize: 200,
      pageToken,
    });

    allRecords.push(...response.records);
    hasMore = response.hasMore;
    pageToken = response.pageToken;
  }

  return { allRecords, table };
}

export async function addRecords(tableName: string, records: IRecordValue[]) {
  const base = bitable.base;
  const table = await base.getTableByName(tableName);
  const result = await table.addRecords(records);
  return result;
}

export function processRecordsWithSpecificFields(
  records: IRecord[],
  field1: IField,
  field2: IField
): IProcessedRecord[] {

  return records.map(record => {
    const recordId = record.recordId;
    const rawUrl = record.fields[field1.id];
    const rawCollected = record.fields[field2.id];

    // 处理链接/文本
    const urlStr = checkers.isSegments(rawUrl) ? rawUrl.map(s => s.text).join('') : String(rawUrl || '');

    // 处理单选/多选/布尔值
    let isCollectedStr = '';
    if (checkers.isSingleSelect(rawCollected)) {
      isCollectedStr = rawCollected.text;
    } else if (typeof rawCollected === 'string') {
      isCollectedStr = rawCollected;
    } else {
      isCollectedStr = String(rawCollected ?? '');
    }

    return {
      recordId: recordId,
      url: urlStr,
      isCollected: isCollectedStr
    };
  });
}