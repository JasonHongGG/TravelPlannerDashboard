
import React, { useState } from 'react';
import { TripDay, TripStop } from '../../types';
import { safeRender } from '../../utils/formatters';
import { getStopIcon, TransportIcon } from '../../utils/icons';
import { Clock, Info, MapPin, Navigation, Sparkles, ClipboardCheck, Check } from 'lucide-react';

interface Props {
  dayData: TripDay | undefined;
  onFocusStop: (stop: TripStop) => void;
  onExplore: () => void;
}

// Sub-component for interactive checklist items with local state
const ChecklistItem: React.FC<{ text: string }> = ({ text }) => {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div 
      onClick={() => setIsChecked(!isChecked)}
      className={`
        group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none
        ${isChecked 
          ? 'bg-gray-50 border-gray-100 opacity-70' 
          : 'bg-white border-gray-100 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5'
        }
      `}
    >
      <div className={`
        mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-300
        ${isChecked
          ? 'bg-brand-500 border-brand-500 scale-100'
          : 'bg-white border-gray-300 group-hover:border-brand-400'
        }
      `}>
        <Check className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${isChecked ? 'scale-100' : 'scale-0'}`} />
      </div>
      <span className={`text-sm font-medium leading-relaxed transition-all duration-200 ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {safeRender(text)}
      </span>
    </div>
  );
};

export default function ItineraryTimeline({ dayData, onFocusStop, onExplore }: Props) {
  if (!dayData) {
     return (
        <div className="text-center py-20 text-gray-500">
           請選擇一天以查看詳情
        </div>
     );
  }

  return (
     <div className="animate-in fade-in duration-300">
        {/* Day Header */}
        <div className="mb-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex-1">
             <div className="flex items-center gap-3 mb-2">
               <div className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                 DAY {dayData.day}
               </div>
               <span className="text-gray-400 text-xs font-medium">{safeRender(dayData.date)}</span>
             </div>
             <h2 className="text-2xl font-bold text-gray-900 leading-tight">
               {dayData.theme || `第 ${dayData.day} 天行程`}
             </h2>
           </div>
           
           <button 
             onClick={onExplore}
             className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-sky-500 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all font-bold text-sm"
           >
              <Sparkles className="w-4 h-4 text-yellow-200 fill-yellow-200" />
              <span>探索與調整</span>
           </button>
        </div>

        {/* Timeline Container */}
        <div className="relative ml-4 md:ml-6 pb-4">
           {/* Continuous Vertical Line */}
           <div className="absolute top-0 bottom-0 left-8 w-0.5 bg-gray-300 transform -translate-x-1/2"></div>
           
           {dayData.stops?.map((stop, idx) => {
              const StopIcon = getStopIcon(stop);
              const prevStop = idx > 0 ? dayData.stops[idx - 1] : null;
              // Use the routeLinkToNext from the previous stop, or construct a generic one
              const navigationUrl = prevStop 
                ? (prevStop.routeLinkToNext || `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(prevStop.name)}&destination=${encodeURIComponent(stop.name)}&travelmode=transit`)
                : null;

              return (
                <div key={idx} className="relative pl-16 pb-12 last:pb-0 group">
                   {/* Timeline Node */}
                   <div className="absolute left-8 -translate-x-1/2 top-0 h-8 w-8 rounded-full border-2 border-brand-500 bg-white z-10 shadow-sm flex items-center justify-center transition-transform duration-300 group-hover:scale-110 flex-shrink-0">
                      <StopIcon className="w-4 h-4 text-brand-600 stroke-[2.5]" />
                   </div>

                   {/* Time & Transport Header */}
                   <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-lg font-bold text-gray-900 bg-transparent">
                         {safeRender(stop.startTime)}
                      </span>
                      {stop.transport && (
                         <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full shadow-sm">
                            <TransportIcon text={safeRender(stop.transport) as string} />
                            <span className="truncate max-w-[150px]">{safeRender(stop.transport)}</span>
                         </div>
                      )}
                   </div>

                   {/* Card */}
                   <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow hover:border-brand-200 relative">
                      <div className="flex justify-between items-start gap-4 mb-3">
                         <h3 className="text-xl font-bold text-gray-900 leading-snug">
                            {safeRender(stop.name)}
                         </h3>
                         <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-md">{safeRender(stop.costEstimate)}</div>
                         </div>
                      </div>

                      <div className="prose prose-sm text-gray-600 mb-4 leading-relaxed">
                         {safeRender(stop.notes)}
                      </div>

                      {/* Stop Meta Data */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                         <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{safeRender(stop.endTime) ? `直到 ${safeRender(stop.endTime)}` : '時間彈性'}</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <Info className="w-3.5 h-3.5 text-gray-400" />
                             <span>{safeRender(stop.openHours) || '查看營業時間'}</span>
                         </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                         {stop.placeLink && (
                            <a 
                               href={stop.placeLink} 
                               target="_blank" 
                               rel="noreferrer"
                               className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-md"
                            >
                               <MapPin className="w-3.5 h-3.5" /> 查看地圖
                            </a>
                         )}
                         {navigationUrl && (
                            <a 
                               href={navigationUrl}
                               target="_blank"
                               rel="noreferrer"
                               className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md"
                            >
                               <Navigation className="w-3.5 h-3.5" /> 路線導航
                            </a>
                         )}
                      </div>

                      {/* Alternatives (if any) */}
                      {stop.alternatives && stop.alternatives.length > 0 && (
                         <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                            <div className="text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">替代方案</div>
                            <div className="flex flex-wrap gap-2">
                               {stop.alternatives.map((alt, i) => (
                                  <span key={i} className="text-xs text-gray-600 bg-gray-50 border border-gray-200 px-2 py-1 rounded">
                                     {safeRender(alt)}
                                  </span>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>
                </div>
              );
           })}
        </div>

        {/* Daily Checklist Redesigned */}
        {dayData.dailyChecklist && dayData.dailyChecklist.length > 0 && (
           <div className="mt-10 mb-8 px-4 md:px-6">
              <div className="bg-gradient-to-br from-brand-50 via-white to-white rounded-2xl border border-brand-100 shadow-sm p-6 relative overflow-hidden">
                  {/* Decorative Background Icon */}
                  <ClipboardCheck className="absolute -right-4 -top-4 w-32 h-32 text-brand-50 opacity-50 rotate-12 pointer-events-none" />
                  
                  <div className="relative z-10">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                          <div className="p-2 bg-white rounded-lg shadow-sm border border-brand-100">
                             <ClipboardCheck className="w-5 h-5 text-brand-600" />
                          </div>
                          <span>旅行備忘錄 & 小撇步</span>
                          <span className="text-xs font-normal text-gray-400 bg-white px-2 py-0.5 rounded-full border border-gray-100">
                             Day {dayData.day}
                          </span>
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {dayData.dailyChecklist.map((item, i) => (
                              <ChecklistItem key={i} text={item} />
                          ))}
                      </div>
                  </div>
              </div>
           </div>
        )}
     </div>
  );
}
