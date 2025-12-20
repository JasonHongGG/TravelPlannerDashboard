import React, { useState, useEffect } from 'react';
import { Trip, TripInput, TripData } from './types';
import Dashboard from './components/Dashboard';
import NewTripForm from './components/NewTripForm';
import TripDetail from './components/TripDetail';
import { generateTripItinerary } from './services/geminiService';

export default function App() {
  // Initialize state directly from localStorage to avoid race conditions
  const [trips, setTrips] = useState<Trip[]>(() => {
    try {
      const saved = localStorage.getItem('ai_travel_trips');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse saved trips", e);
      return [];
    }
  });

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');

  // Save to local storage whenever trips change
  useEffect(() => {
    localStorage.setItem('ai_travel_trips', JSON.stringify(trips));
  }, [trips]);

  const handleCreateTrip = async (input: TripInput) => {
    const newTrip: Trip = {
      id: crypto.randomUUID(),
      title: input.destination, // Temporary title
      createdAt: Date.now(),
      status: 'generating',
      input,
    };

    setTrips(prev => [newTrip, ...prev]);
    
    // Trigger AI Generation in background
    generateTripItinerary(input)
      .then(data => {
        setTrips(prev => prev.map(t => 
          t.id === newTrip.id 
            ? { ...t, status: 'complete', data, generationTimeMs: Date.now() - t.createdAt } 
            : t
        ));
      })
      .catch(err => {
        setTrips(prev => prev.map(t => 
          t.id === newTrip.id 
            ? { ...t, status: 'error', errorMsg: err.message, generationTimeMs: Date.now() - t.createdAt } 
            : t
        ));
      });
  };

  const handleSelectTrip = (trip: Trip) => {
    setSelectedTripId(trip.id);
    setView('detail');
  };

  const handleUpdateTripData = (tripId: string, newData: TripData) => {
    setTrips(prev => prev.map(t => 
      t.id === tripId 
        ? { ...t, data: newData } 
        : t
    ));
  };

  const handleDeleteTrip = (tripId: string) => {
    setTrips(prev => {
      const newTrips = prev.filter(t => t.id !== tripId);
      return newTrips;
    });
    if (selectedTripId === tripId) {
      setSelectedTripId(null);
      setView('dashboard');
    }
  };

  const handleImportTrip = (tripData: Trip) => {
    // Regenerate ID to avoid conflicts if importing the same trip twice
    const newTrip = {
      ...tripData,
      id: crypto.randomUUID(),
      title: tripData.title,
      createdAt: Date.now()
    };
    setTrips(prev => [newTrip, ...prev]);
    alert("行程匯入成功！");
  };

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard 
          trips={trips} 
          onNewTrip={() => setIsModalOpen(true)}
          onSelectTrip={handleSelectTrip}
          onDeleteTrip={handleDeleteTrip}
          onImportTrip={handleImportTrip}
        />
      )}

      {view === 'detail' && selectedTrip && (
        <TripDetail 
          trip={selectedTrip} 
          onBack={() => setView('dashboard')}
          onUpdateTrip={handleUpdateTripData}
        />
      )}

      <NewTripForm 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateTrip} 
      />
    </>
  );
}