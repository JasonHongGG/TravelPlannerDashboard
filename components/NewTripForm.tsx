import React, { useState, useRef } from 'react';
import { TripInput } from '../types';
import { X, Calendar, MapPin, Users, Heart, DollarSign, Train, Home, Clock, CheckSquare, Languages, AlertCircle, Download, Upload } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TripInput) => void;
}

const InputField = ({ label, icon: Icon, value, onChange, placeholder, required = false }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-600" />
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="text"
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

const TextAreaField = ({ label, icon: Icon, value, onChange, placeholder, required = false }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
      <Icon className="w-4 h-4 text-brand-600" />
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

export default function NewTripForm({ isOpen, onClose, onSubmit }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<TripInput>({
    dateRange: '',
    destination: '',
    travelers: '',
    interests: '',
    budget: '',
    transport: '',
    accommodation: '',
    pace: '',
    mustVisit: '',
    language: 'English / Metric',
    constraints: ''
  });

  const handleChange = (key: keyof TripInput, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(formData, null, 2));
    
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Format: yyyy-mm-dd_hh:mm:ss
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    // Sanitize destination to be filename safe (allow unicode for chinese inputs, just remove reserved chars)
    const safeDest = formData.destination ? formData.destination.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() : 'draft';
    const fileName = `trip_config_${safeDest}_${timestamp}.json`;

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
    if (!fileObj) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (event.target?.result) {
           const json = JSON.parse(event.target.result as string);
           // Basic validation: Check if it has at least one key matching our type
           // Or just spread it.
           setFormData(prev => ({ ...prev, ...json }));
        }
      } catch (error) {
         console.error("Failed to parse JSON", error);
         alert("Invalid JSON file");
      }
    };
    reader.readAsText(fileObj);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-brand-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            ✨ Plan New Adventure
          </h2>
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
                className="p-2 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                title="Import Configuration"
             >
                <Upload className="w-4 h-4" /> Import
             </button>
             <button 
                onClick={handleExport}
                className="p-2 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                title="Export Configuration"
             >
                <Download className="w-4 h-4" /> Export
             </button>
             <div className="h-4 w-px bg-gray-300 mx-1"></div>
             <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-600" />
             </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <form id="new-trip-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            
            <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
               <p className="text-sm text-blue-800 flex items-start gap-2">
                 <AlertCircle className="w-5 h-5 flex-shrink-0" />
                 Please fill in all details for the best AI itinerary results.
               </p>
            </div>

            <InputField 
              label="Destination" 
              icon={MapPin} 
              value={formData.destination} 
              onChange={(v: string) => handleChange('destination', v)} 
              placeholder="e.g., Tokyo, Japan" 
              required 
            />
            
            <InputField 
              label="Date Range & Days" 
              icon={Calendar} 
              value={formData.dateRange} 
              onChange={(v: string) => handleChange('dateRange', v)} 
              placeholder="e.g., Oct 10 - Oct 17 (7 days)" 
              required 
            />

            <InputField 
              label="Travelers" 
              icon={Users} 
              value={formData.travelers} 
              onChange={(v: string) => handleChange('travelers', v)} 
              placeholder="e.g., 2 Adults, 1 Child" 
              required 
            />

            <InputField 
              label="Budget Level" 
              icon={DollarSign} 
              value={formData.budget} 
              onChange={(v: string) => handleChange('budget', v)} 
              placeholder="e.g., Mid-range, approx $2000 total" 
              required 
            />

            <InputField 
              label="Pace" 
              icon={Clock} 
              value={formData.pace} 
              onChange={(v: string) => handleChange('pace', v)} 
              placeholder="e.g., Relaxed, start 10am, end 8pm"
              required 
            />

            <InputField 
              label="Transport Pref" 
              icon={Train} 
              value={formData.transport} 
              onChange={(v: string) => handleChange('transport', v)} 
              placeholder="e.g., Public transport primarily"
              required 
            />
            
            <div className="md:col-span-2">
               <InputField 
                label="Accommodation Details" 
                icon={Home} 
                value={formData.accommodation} 
                onChange={(v: string) => handleChange('accommodation', v)} 
                placeholder="e.g., Staying in Shinjuku for 4 nights, Kyoto 3 nights"
                required 
              />
            </div>

            <div className="md:col-span-2">
              <TextAreaField 
                label="Interests & Style" 
                icon={Heart} 
                value={formData.interests} 
                onChange={(v: string) => handleChange('interests', v)} 
                placeholder="e.g., Foodie, Anime, Temples, Nature. Prefer less crowded spots."
                required 
              />
            </div>

            <div className="md:col-span-2">
              <TextAreaField 
                label="Must Visit / Avoid" 
                icon={CheckSquare} 
                value={formData.mustVisit} 
                onChange={(v: string) => handleChange('mustVisit', v)} 
                placeholder="Must see: Tokyo Tower. Avoid: Disney (too crowded)."
                required 
              />
            </div>
            
             <div className="md:col-span-2">
              <InputField 
                label="Language / Units" 
                icon={Languages} 
                value={formData.language} 
                onChange={(v: string) => handleChange('language', v)} 
                placeholder="e.g., English, Metric System"
                required 
              />
            </div>
             <div className="md:col-span-2">
              <TextAreaField 
                label="Other Constraints" 
                icon={AlertCircle} 
                value={formData.constraints} 
                onChange={(v: string) => handleChange('constraints', v)} 
                placeholder="e.g., Flight arrives at Narita at 5pm. Allergic to peanuts." 
              />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="new-trip-form"
            className="px-6 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-md flex items-center gap-2"
          >
             Generate Itinerary
          </button>
        </div>
      </div>
    </div>
  );
}