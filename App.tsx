import React, { useState, useEffect } from 'react';
import { Trip, TripInput, TripData } from './types';
import Dashboard from './components/Dashboard';
import NewTripForm from './components/NewTripForm';
import TripDetail from './components/TripDetail';
import { generateTripItinerary } from './services/geminiService';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_travel_trips');
    if (saved) {
      try {
        setTrips(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved trips", e);
      }
    }
  }, []);

  // Save to local storage on change
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

  const selectedTrip = trips.find(t => t.id === selectedTripId);

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard 
          trips={trips} 
          onNewTrip={() => setIsModalOpen(true)}
          onSelectTrip={handleSelectTrip}
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