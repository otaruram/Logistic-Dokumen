import { createContext, useContext, ReactNode } from "react";

// Context is now just a pass-through since we use CSS responsiveness
const DeviceContext = createContext<any>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
    return (
        <DeviceContext.Provider value={{}}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => {
    return {};
};
