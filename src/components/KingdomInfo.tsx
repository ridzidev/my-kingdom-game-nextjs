'use client';

import { useGameStore } from '@/store/gameStore';

export const KingdomInfo = () => {
  const { selectedKingdom, kingdoms } = useGameStore();
  const kingdom = kingdoms.find((k) => k.id === selectedKingdom);

  if (!kingdom) return null;

  return (
    <div className="fixed top-4 right-4 w-96 bg-black/80 text-white p-4 rounded-lg shadow-lg z-50">
      <h2 className="text-xl font-fantasy mb-4">{kingdom.name}</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-fantasy mb-2">Ruler</h3>
          <p className="text-gray-300">{kingdom.ruler}</p>
        </div>

        <div>
          <h3 className="text-lg font-fantasy mb-2">Resources</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-purple-900/50 p-2 rounded">
              <p className="text-sm text-gray-400">Gold</p>
              <p className="text-yellow-400">{kingdom.resources.gold.toLocaleString()}</p>
            </div>
            <div className="bg-purple-900/50 p-2 rounded">
              <p className="text-sm text-gray-400">Food</p>
              <p className="text-green-400">{kingdom.resources.food.toLocaleString()}</p>
            </div>
            <div className="bg-purple-900/50 p-2 rounded">
              <p className="text-sm text-gray-400">Magic</p>
              <p className="text-blue-400">{kingdom.resources.magic.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-fantasy mb-2">Development</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-purple-900/50 p-2 rounded">
              <p className="text-sm text-gray-400">Technology</p>
              <p className="text-cyan-400">Level {kingdom.development.technology}</p>
            </div>
            <div className="bg-purple-900/50 p-2 rounded">
              <p className="text-sm text-gray-400">Magic</p>
              <p className="text-purple-400">Level {kingdom.development.magic}</p>
            </div>
            <div className="bg-purple-900/50 p-2 rounded">
              <p className="text-sm text-gray-400">Culture</p>
              <p className="text-pink-400">Level {kingdom.development.culture}</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-fantasy mb-2">Special Features</h3>
          <ul className="list-disc list-inside text-gray-300">
            {kingdom.specialFeatures.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-fantasy mb-2">Magical Resources</h3>
          <ul className="list-disc list-inside text-gray-300">
            {kingdom.magicalResources.map((resource, index) => (
              <li key={index}>{resource}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-fantasy mb-2">Relations</h3>
          <div className="space-y-2">
            {Object.entries(kingdom.relations).map(([targetId, relation]) => {
              const targetKingdom = kingdoms.find((k) => k.id === targetId);
              if (!targetKingdom) return null;

              return (
                <div key={targetId} className="bg-purple-900/50 p-2 rounded">
                  <p className="text-sm text-gray-400">{targetKingdom.name}</p>
                  <p className={relation > 0 ? 'text-green-400' : 'text-red-400'}>
                    {relation > 0 ? '+' : ''}{relation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}; 