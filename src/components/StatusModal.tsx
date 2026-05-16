import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadAll: boolean;
  totalCollection: number;
  collectionCount: number;
}

export default function StatusModal({ isOpen, onClose, downloadAll,totalCollection,collectionCount}: StatusModalProps) {
  const [downloadCount, setDownloadCount] = useState(0);
  const totalDownload = 100;

  // Reset counts when modal opens
  useEffect(() => {
    if (isOpen) {
      setDownloadCount(0);
    }
  }, [isOpen]);
  // Simulate Download Progress
  useEffect(() => {
    if (!isOpen || !downloadAll) return;

    const interval = setInterval(() => {
      setDownloadCount(prev => {
        if (prev < totalDownload) return prev + 5;
        return prev;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, downloadAll]);

  // Auto-close logic
  useEffect(() => {
    if (!isOpen) return;

    const isCollectionFinished = collectionCount === totalCollection;
    const isDownloadFinished = !downloadAll || downloadCount === totalDownload;

    if (isCollectionFinished && isDownloadFinished) {
      const timer = setTimeout(() => {
        onClose();
      }, 1500); // 采集和下载完成后等待1.5秒自动关闭
      return () => clearTimeout(timer);
    }
  }, [collectionCount, downloadCount, downloadAll, isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl"
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#f8fafc] border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >


            {/* Collection Status Section */}
            <div className="mb-6">
              <div className="bg-[#cbd5e1] border-2 border-black rounded-lg py-2 px-4 mb-4">
                <h3 className="text-xl font-bold">采集状态</h3>
              </div>
              <div className="flex justify-between px-2 text-lg font-medium">
                <span>待采集: <span className="text-blue-600">{totalCollection}</span></span>
                <span>已采集: <span className="text-green-600">{collectionCount}</span></span>
              </div>
            </div>

            {/* Download Status Section */}
            <div className={downloadAll ? "opacity-100" : "opacity-40 grayscale pointer-events-none"}>
              <div className="bg-[#cbd5e1] border-2 border-black rounded-lg py-2 px-4 mb-4">
                <h3 className="text-xl font-bold">下载状态</h3>
              </div>
              <div className="space-y-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">下载目标:</span>
                  <span className="text-gray-700">{downloadAll ? "博主名称" : "未开启下载"}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>下载进度:</span>
                    <span>{downloadAll ? `${downloadCount}/${totalDownload}` : "0/0"}</span>
                  </div>
                  <div className="w-full h-8 bg-white border-2 border-black rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: downloadAll ? `${(downloadCount / totalDownload) * 100}%` : '0%' }}
                      className="h-full bg-[#e0e7ff]"
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {downloadAll ? `${downloadCount}/${totalDownload}` : "0/0"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Completion Badge */}
            {(collectionCount === totalCollection && (!downloadAll || downloadCount === totalDownload)) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 text-center text-green-600 font-bold"
              >
                任务已完成，即将自动关闭...
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
