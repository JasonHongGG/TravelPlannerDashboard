import React, { useState, useEffect, useRef } from 'react';
import { Trip } from '../types';
import { Plus, Map, Loader2, AlertCircle, ChevronRight, Trash2, Download, Upload } from 'lucide-react';

interface Props {
  trips: Trip[];
  onNewTrip: () => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onImportTrip: (trip: Trip) => void;
}

// Sub-component for live timer updates
const LiveTimer = ({ startTime }: { startTime: number }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    // Initial update
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="ml-1 tabular-nums">({elapsedSeconds}秒)</span>;
};

// Robust Delete Button with internal confirmation state
const DeleteButton = ({ onDelete }: { onDelete: () => void }) => {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirming) {
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-2 rounded-full transition-all flex items-center gap-1 z-50 relative ${
        confirming 
          ? 'bg-red-100 text-red-600 ring-2 ring-red-500 ring-offset-1 px-3' 
          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
      }`}
      title={confirming ? "再次點擊以確認刪除" : "刪除行程"}
    >
      <Trash2 className={`w-4 h-4 pointer-events-none ${confirming ? 'fill-current' : ''}`} />
      {confirming && <span className="text-xs font-bold whitespace-nowrap pointer-events-none">確認?</span>}
    </button>
  );
};

export default function Dashboard({ trips, onNewTrip, onSelectTrip, onDeleteTrip, onImportTrip }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = (e: React.MouseEvent, trip: Trip) => {
    e.preventDefault();
    e.stopPropagation();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(trip, null, 2));
    const fileName = `trip_full_backup_${trip.title || 'trip'}_${new Date().toISOString().slice(0,10)}.json`;
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileObj = e.target.files && e.target.files[0];
    if (!fileObj) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (event.target?.result) {
           const json = JSON.parse(event.target.result as string);
           // Basic validation
           if (json.input && json.status) {
             onImportTrip(json as Trip);
           } else {
             alert("無效的行程檔案格式");
           }
        }
      } catch (error) {
         console.error("Failed to parse JSON", error);
         alert("檔案讀取失敗");
      }
    };
    reader.readAsText(fileObj);
    e.target.value = ''; // Reset
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-brand-600 p-2 rounded-lg">
                <Map className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight hidden md:block">Travel Planner Dashboard</span>
              <span className="text-xl font-bold text-gray-900 tracking-tight md:hidden">Travel Planner</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".json"
              />
              <button
                onClick={handleImportClick}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-all"
                title="匯入完整行程"
              >
                <Upload className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">匯入行程</span>
              </button>
              <button 
                onClick={onNewTrip}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all"
              >
                <Plus className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">新增行程</span>
                <span className="md:hidden">新增</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">您的行程</h1>
          <p className="mt-1 text-gray-500">管理您生成的行程並規劃新的冒險。</p>
        </div>

        {trips.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-300">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <Map className="w-12 h-12" />
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">尚未有行程</h3>
            <p className="mt-1 text-sm text-gray-500">開始建立您的第一個 AI 行程吧。</p>
            <div className="mt-6">
              <button
                onClick={onNewTrip}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                規劃第一個行程
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <div 
                key={trip.id} 
                className="group bg-white overflow-hidden rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-lg transition-all relative flex flex-col h-full"
              >
                {/* Status Indicator */}
                <div className="absolute top-4 right-4 z-10 pointer-events-none">
                  {trip.status === 'generating' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shadow-sm border border-blue-200">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> 
                      生成中 <LiveTimer startTime={trip.createdAt} />
                    </span>
                  )}
                  {trip.status === 'complete' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 shadow-sm border border-green-200">
                      完成 {trip.generationTimeMs ? `(${(trip.generationTimeMs / 1000).toFixed(1)}秒)` : ''}
                    </span>
                  )}
                   {trip.status === 'error' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 shadow-sm border border-red-200">
                      錯誤
                    </span>
                  )}
                </div>

                {/* Content Body - Clickable */}
                <div 
                  className="p-6 flex-1 cursor-pointer relative z-0"
                  onClick={() => onSelectTrip(trip)}
                >
                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center">
                       <Map className="h-6 w-6 text-brand-600" />
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-600 transition-colors truncate">
                        {trip.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        建立於: {new Date(trip.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                       <span className="font-semibold text-gray-500 w-12 flex-shrink-0 text-xs uppercase tracking-wide">日期</span> 
                       <span className="truncate">{trip.input.dateRange}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                       <span className="font-semibold text-gray-500 w-12 flex-shrink-0 text-xs uppercase tracking-wide">人數</span> 
                       <span className="truncate">{trip.input.travelers}</span>
                    </div>
                  </div>
                </div>
                
                {/* Footer Actions - Separate Click Area with Higher Z-Index */}
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center gap-2 z-30 relative">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectTrip(trip);
                    }}
                    className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-1 hover:underline decoration-brand-300 underline-offset-4 bg-transparent border-0 p-0 cursor-pointer"
                  >
                    查看詳情 <ChevronRight className="w-3 h-3 pointer-events-none" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => handleExport(e, trip)}
                      className="p-2 text-gray-400 hover:text-brand-600 hover:bg-white rounded-full transition-all relative z-40"
                      title="匯出備份"
                    >
                      <Download className="w-4 h-4 pointer-events-none" />
                    </button>
                    
                    {/* New Robust Delete Button */}
                    <DeleteButton onDelete={() => onDeleteTrip(trip.id)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}