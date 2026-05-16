import React, { useState, useEffect } from "react";
import { toBeCollectedRecords } from "../core/douyinSpider";
import {
  getDouyinWorkInfo,
  getUserInfo,
  downloadVideoToBase64,
} from "../core/douyinServer";
import { IField, ISingleSelectField } from "@lark-base-open/js-sdk";
import { useBitable } from "../contexts/BitableContext";

const PENDING_TABLE_KEY = "douyin_pending_table_name";

export default function BatchCollectionModule() {
  const [pendingTableName, setPendingTableName] = useState("");
  const { tables, loading: tablesLoading, error: tablesError } = useBitable();

  // 组件加载时从 localStorage 读取上次的数据
  useEffect(() => {
    const savedPendingTable = localStorage.getItem(PENDING_TABLE_KEY);
    if (savedPendingTable) {
      setPendingTableName(savedPendingTable);
    }
  }, []);

  const handleStartBatchCollection = async () => {
    if (!pendingTableName.trim()) {
      alert("请选择待采表名称");
      return;
    }

    try {
      // 1. 获取所有记录
      const { allRecords, table } =
        await toBeCollectedRecords(pendingTableName);

      // 2. 获取字段实例
      let url_field: IField;
      let collectionStatusField: ISingleSelectField;
      let accountHomePageField: IField;
      let accountNameField: IField;
      let douyinIdField: IField;
      let signatureField: IField;
      let genderField: IField;
      let totalFavoritedField: IField;
      let followerCountField: IField;
      let awemeCountField: IField;

      try {
        url_field = await table.getFieldByName("作品链接");
      } catch (fieldError) {
        console.error('未找到"作品链接"字段:', fieldError);
        alert(`错误: 未找到"作品链接"字段，请检查待采表结构`);
        return;
      }

      try {
        collectionStatusField = (await table.getFieldByName(
          "采集状态",
        )) as ISingleSelectField;
      } catch (fieldError) {
        console.error('未找到"采集状态"字段:', fieldError);
        alert(`错误: 未找到"采集状态"字段，请检查待采表结构`);
        return;
      }

      try {
        accountHomePageField = await table.getFieldByName("账号主页链接");
      } catch (fieldError) {
        console.error('未找到"账号主页链接"字段:', fieldError);
        alert(`错误: 未找到"账号主页链接"字段，请检查待采表结构`);
        return;
      }

      try {
        accountNameField = await table.getFieldByName("账号名称");
      } catch (fieldError) {
        console.error('未找到"账号名称"字段:', fieldError);
      }

      try {
        douyinIdField = await table.getFieldByName("抖音号");
      } catch (fieldError) {
        console.error('未找到"抖音号"字段:', fieldError);
      }

      try {
        signatureField = await table.getFieldByName("签名");
      } catch (fieldError) {
        console.error('未找到"签名"字段:', fieldError);
      }

      try {
        genderField = await table.getFieldByName("性别");
      } catch (fieldError) {
        console.error('未找到"性别"字段:', fieldError);
      }

      try {
        totalFavoritedField = await table.getFieldByName("获赞");
      } catch (fieldError) {
        console.error('未找到"获赞"字段:', fieldError);
      }

      try {
        followerCountField = await table.getFieldByName("粉丝量");
      } catch (fieldError) {
        console.error('未找到"粉丝量"字段:', fieldError);
      }

      try {
        awemeCountField = await table.getFieldByName("作品数量");
      } catch (fieldError) {
        console.error('未找到"作品数量"字段:', fieldError);
      }

      let workAttachmentField: IField;
      try {
        workAttachmentField = await table.getFieldByName("作品");
      } catch (fieldError) {
        console.error('未找到"作品"字段:', fieldError);
        alert(`错误: 未找到"作品"(附件)字段，请检查待采表结构`);
        return;
      }
      // 获取采集状态字段的选项，用于后续更新状态
      const statusOptions = await collectionStatusField.getOptions();
      const collectedOption = statusOptions.find((opt) => opt.name === "采集");
      // 3. 获取所有记录的作品链接值
      for (let index = 0; index < allRecords.length; index++) {
        const record = allRecords[index];

        // 读取采集状态
        let currentStatus: string | null = null;
        try {
          const statusValue = await collectionStatusField.getValue(
            record.recordId,
          );
          currentStatus =
            typeof statusValue === "object"
              ? (statusValue as any).text
              : String(statusValue || "");
        } catch (statusError) {
          console.error(`   ⚠️ 读取采集状态失败:`, statusError);
        }
        if (
          currentStatus &&
          currentStatus !== "待采" &&
          currentStatus !== "待采集"
        ) {
          console.log(
            `${index + 1}. 跳过（采集状态: ${currentStatus || "空"}）`,
          );
          if (index < allRecords.length - 1) {
            console.log("---");
          }
          continue;
        }
        try {
          const urlValue = await url_field.getValue(record.recordId);

          // 提取实际链接文本
          let displayUrl: string;
          if (typeof urlValue === "string") {
            displayUrl = urlValue;
          } else if (urlValue && typeof urlValue === "object") {
            displayUrl =
              (urlValue as any).link ||
              (urlValue as any).text ||
              (urlValue as any).url ||
              JSON.stringify(urlValue);
          } else {
            displayUrl = String(urlValue || "");
          }
          if (displayUrl) {
            try {
              const workInfo = await getDouyinWorkInfo(displayUrl);
              let downloadUrl: string | string[] | null = null;
              if (workInfo && workInfo.data) {
                const awemeDetail = workInfo.data;
                const awemeType = awemeDetail.aweme_type;

                if (awemeType === 0) {
                  const videoPlayAddr = awemeDetail?.video?.play_addr;
                  const urlList = videoPlayAddr?.url_list || [];

                  if (urlList.length > 0) {
                    downloadUrl = urlList[2];
                    console.log(`   🎬 视频类型，下载地址 ${downloadUrl}`);
                  }
                } else if (awemeType === 68) {
                  const images = awemeDetail.images || [];
                  downloadUrl = images
                    .map((img: any) => img?.url_list?.[0])
                    .filter(Boolean);
                  console.log(
                    `   🖼️ 图文类型，共 ${(downloadUrl as string[]).length} 张图片链接已提取`,
                  );
                }

                if (downloadUrl) {
                  try {
                    let cachedIndex: string[] = [];
                    const indexData = localStorage.getItem(
                      "douyin_download_cache_index",
                    );
                    if (indexData) {
                      cachedIndex = JSON.parse(indexData);
                    }
                    if (!cachedIndex.includes(record.recordId)) {
                      cachedIndex.push(record.recordId);
                      localStorage.setItem(
                        "douyin_download_cache_index",
                        JSON.stringify(cachedIndex),
                      );
                    }
                    if (typeof downloadUrl === "string") {
                      if (awemeType === 0) {
                        try {
                          console.log(`   🎬 开始下载视频文件...`);
                          const downloadResult =
                            await downloadVideoToBase64(downloadUrl);
                          if (downloadResult.success && downloadResult.data) {
                            const videoData = downloadResult.data.base64;
                            const fileName =
                              downloadResult.data.file_name || "video.mp4";
                            const mimeType =
                              downloadResult.data.mime_type || "video/mp4";
                            
                            console.log(`   ✅ 视频下载成功！开始上传到作品字段...`);
                            
                            try {
                              const byteCharacters = atob(videoData);
                              const byteNumbers = new Array(byteCharacters.length);
                              for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                              }
                              const byteArray = new Uint8Array(byteNumbers);
                              const videoFile = new File([byteArray], fileName, { type: mimeType });
                              
                              await workAttachmentField.setValue(record.recordId, [videoFile]);
                              console.log(`   ✅ 视频已上传到作品字段！`);
                            } catch (uploadError) {
                              console.error(
                                "   ❌ 上传视频到作品字段失败:",
                                uploadError instanceof Error
                                  ? uploadError.message
                                  : String(uploadError),
                              );
                            }
                          } else {
                            console.error(
                              `   ❌ 视频下载失败:`,
                              downloadResult.error || "未知错误",
                            );
                          }
                        } catch (videoError) {
                          console.error(
                            "   ❌ 下载视频时出错:",
                            videoError instanceof Error
                              ? videoError.message
                              : String(videoError),
                          );
                        }
                      }
                    } else {
                      if (awemeType === 68 && Array.isArray(downloadUrl)) {
                        try {
                          console.log(`   🖼️ 开始下载图片...`);
                          const downloadedImages: File[] = [];
                          for (
                            let imgIndex = 0;
                            imgIndex < Math.min(downloadUrl.length, 9);
                            imgIndex++
                          ) {
                            const imgUrl = downloadUrl[imgIndex];
                            console.log(
                              `      ↓ 下载第 ${imgIndex + 1}/${Math.min(downloadUrl.length, 9)} 张图片...`,
                            );

                            try {
                              const imgDownloadResult =
                                await downloadVideoToBase64(imgUrl);
                              if (
                                imgDownloadResult.success &&
                                imgDownloadResult.data
                              ) {
                                const imgData = imgDownloadResult.data.base64;
                                const imgFileName =
                                  imgDownloadResult.data.file_name ||
                                  `image_${imgIndex + 1}.jpg`;
                                const imgMimeType =
                                  imgDownloadResult.data.mime_type ||
                                  "image/jpeg";

                                const byteCharacters = atob(imgData);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);
                                const imageFile = new File([byteArray], imgFileName, { type: imgMimeType });
                                
                                downloadedImages.push(imageFile);
                                console.log(
                                  `         ✅ 第 ${imgIndex + 1} 张图片下载成功`,
                                );
                              } else {
                                console.error(
                                  `         ❌ 第 ${imgIndex + 1} 张图片下载失败:`,
                                  imgDownloadResult.error,
                                );
                              }
                            } catch (singleImgError) {
                              console.error(
                                `         ❌ 第 ${imgIndex + 1} 张图片出错:`,
                                singleImgError instanceof Error
                                  ? singleImgError.message
                                  : String(singleImgError),
                              );
                            }
                          }
                          if (downloadedImages.length > 0) {
                            console.log(
                              `   ✅ 图片下载完成，共成功下载 ${downloadedImages.length} 张，开始上传到作品字段...`,
                            );
                            try {
                              await workAttachmentField.setValue(record.recordId, downloadedImages);
                              console.log(`   ✅ 图片已上传到作品字段！`);
                            } catch (imgUploadError) {
                              console.error(
                                "   ❌ 上传图片到作品字段失败:",
                                imgUploadError instanceof Error
                                  ? imgUploadError.message
                                  : String(imgUploadError),
                              );
                            }
                          }
                        } catch (imagesError) {
                          console.error(
                            "   ❌ 下载图片时出错:",
                            imagesError instanceof Error
                              ? imagesError.message
                              : String(imagesError),
                          );
                        }
                      }
                    }
                  } catch (cacheError) {
                    console.error("   ❌ 缓存下载链接失败:", cacheError);
                  }
                }
              }
              let userHomePageUrl: string | null = null;
              if (displayUrl.includes("/user/")) {
                const match = displayUrl.match(
                  /(https?:\/\/[^\/]+\/user\/[^?&]+)/,
                );
                if (match && match[1]) {
                  userHomePageUrl = match[1];
                }
              }

              if (userHomePageUrl) {
                try {
                  const userInfo = await getUserInfo(userHomePageUrl);
                  if (userInfo && userInfo.data) {
                    const userData = userInfo.data;
                    try {
                      const fieldsToUpdate: Record<string, any> = {};
                      if (accountNameField && userData.nickname) {
                        fieldsToUpdate[accountNameField.id] = userData.nickname;
                      }

                      if (douyinIdField && userData.unique_id) {
                        fieldsToUpdate[douyinIdField.id] = userData.unique_id;
                      }

                      if (signatureField && userData.signature) {
                        fieldsToUpdate[signatureField.id] = userData.signature;
                      }

                      if (genderField && userData.gender !== undefined) {
                        const genderText = userData.gender === 1 ? "男" : "女";
                        fieldsToUpdate[genderField.id] = genderText;
                      }

                      if (totalFavoritedField && userData.total_favorited) {
                        fieldsToUpdate[totalFavoritedField.id] =
                          userData.total_favorited;
                      }

                      if (followerCountField && userData.follower_count) {
                        fieldsToUpdate[followerCountField.id] =
                          userData.follower_count;
                      }

                      if (awemeCountField && userData.aweme_count) {
                        fieldsToUpdate[awemeCountField.id] =
                          userData.aweme_count;
                      }

                      if (Object.keys(fieldsToUpdate).length > 0) {
                        await table.setRecord(record.recordId, {
                          fields: fieldsToUpdate,
                        });
                      }
                    } catch (fillError) {
                      console.error("   ❌ 填充用户信息失败:");
                      console.error(
                        "      错误信息:",
                        fillError instanceof Error
                          ? fillError.message
                          : String(fillError),
                      );
                    }
                  }
                } catch (userError) {
                  console.error("   ❌ 获取作者信息失败:");
                  console.error(
                    "      错误信息:",
                    userError instanceof Error
                      ? userError.message
                      : String(userError),
                  );
                }
                try {
                  await accountHomePageField.setValue(record.recordId, {
                    type: "url",
                    link: userHomePageUrl,
                    text: "主页链接",
                  });
                  if (collectedOption) {
                    await table.setRecord(record.recordId, {
                      fields: {
                        [collectionStatusField.id]: {
                          id: collectedOption.id,
                          text: collectedOption.name,
                        },
                      },
                    });
                  }
                  console.log("");
                } catch (updateError) {
                  console.error("   ❌ 填充字段或更新状态失败:");
                  console.error(
                    "      错误信息:",
                    updateError instanceof Error
                      ? updateError.message
                      : String(updateError),
                  );
                }
              } else {
                console.log(
                  "   ⚠️ 链接格式不包含 /user/ 路径，无法提取作者主页",
                );
              }
            } catch (apiError) {
              console.error(`   ❌ 获取作品信息失败:`);
              console.error(
                "      错误类型:",
                apiError instanceof Error ? apiError.name : typeof apiError,
              );
              console.error(
                "      错误信息:",
                apiError instanceof Error ? apiError.message : String(apiError),
              );
              if (
                apiError instanceof Error &&
                apiError.message.includes("422")
              ) {
                console.error(
                  "      💡 提示: 422错误通常表示URL格式无效或不是视频链接",
                );
                console.error(
                  "      🔗 当前URL:",
                  displayUrl.substring(0, 100) +
                    (displayUrl.length > 100 ? "..." : ""),
                );
              }
            }
          }
        } catch (error) {
          console.log(`${index + 1}. URL: (读取失败)`);
        }
      }
    } catch (error) {
      console.error("流程失败:", error);
      alert(`失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  return (
    <div className="relative bg-[#f0f4f8] border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      {/* Header */}
      <div className="bg-[#e2e8f0] border-b-2 border-black p-4">
        <h2 className="text-xl font-bold text-gray-800">批量采集指定账户</h2>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {/* Pending Collection Table Name */}
        <div className="flex items-center gap-4">
          <label className="text-lg font-bold text-gray-700 min-w-[120px]">
            待采表名称
          </label>
          {tablesLoading ? (
            <span className="flex-1 text-gray-500">加载中...</span>
          ) : tablesError ? (
            <span className="flex-1 text-red-500">{tablesError}</span>
          ) : (
            <select
              value={pendingTableName}
              onChange={(e) => {
                const value = e.target.value;
                setPendingTableName(value);
                localStorage.setItem(PENDING_TABLE_KEY, value);
              }}
              className="flex-1 bg-white border-2 border-black rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">请选择待采表...</option>
              {tables.map((table) => (
                <option key={table.id} value={table.name}>
                  {table.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartBatchCollection}
          className="w-full py-4 bg-white border-2 border-black rounded-xl text-xl font-bold hover:bg-gray-50 active:translate-y-1 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          查看作品详情
        </button>
      </div>
    </div>
  );
}
