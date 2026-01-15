import React, { createContext, useContext, useState, useEffect } from 'react';

interface PointPackage {
    id: string;
    points: number;
    price: number;
    name: string;
    popular?: boolean;
    description: string;
}

interface Transaction {
    id: string;
    date: number;
    amount: number;
    type: 'purchase' | 'spend';
    description: string;
}

interface PointsContextType {
    balance: number;
    transactions: Transaction[];
    purchasePoints: (packageId: string) => Promise<void>;
    spendPoints: (amount: number, description: string) => boolean;
    isLoading: boolean;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const AVAILABLE_PACKAGES: PointPackage[] = [
    {
        id: 'basic',
        name: '旅人起步',
        points: 500,
        price: 150,
        description: '適合體驗單次行程生成',
    },
    {
        id: 'pro',
        name: '探險家',
        points: 1200,
        price: 300,
        popular: true,
        description: '最受歡迎！適合規劃 2-3 趟旅程',
    },
    {
        id: 'ultimate',
        name: '環遊世界',
        points: 3000,
        price: 600,
        description: '重度旅行者首選，盡情探索',
    }
];

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [balance, setBalance] = useState(520); // Initial mock balance
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const purchasePoints = async (packageId: string): Promise<void> => {
        setIsLoading(true);
        const pkg = AVAILABLE_PACKAGES.find(p => p.id === packageId);

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (pkg) {
                    setBalance(prev => prev + pkg.points);
                    const newTransaction: Transaction = {
                        id: crypto.randomUUID(),
                        date: Date.now(),
                        amount: pkg.points,
                        type: 'purchase',
                        description: `購買 ${pkg.name} 方案`
                    };
                    setTransactions(prev => [newTransaction, ...prev]);
                    setIsLoading(false);
                    resolve();
                } else {
                    setIsLoading(false);
                    reject(new Error("Package not found"));
                }
            }, 2000); // 2 seconds mock delay
        });
    };

    const spendPoints = (amount: number, description: string): boolean => {
        if (balance >= amount) {
            setBalance(prev => prev - amount);
            const newTransaction: Transaction = {
                id: crypto.randomUUID(),
                date: Date.now(),
                amount: -amount,
                type: 'spend',
                description
            };
            setTransactions(prev => [newTransaction, ...prev]);
            return true;
        }
        return false;
    };

    return (
        <PointsContext.Provider value={{ balance, transactions, purchasePoints, spendPoints, isLoading }}>
            {children}
        </PointsContext.Provider>
    );
};

export const usePoints = () => {
    const context = useContext(PointsContext);
    if (!context) {
        throw new Error('usePoints must be used within a PointsProvider');
    }
    return context;
};
