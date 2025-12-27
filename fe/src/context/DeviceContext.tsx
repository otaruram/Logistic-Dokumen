import { createContext, useContext, ReactNode } from "react";

type DeviceMode = "tablet";

interface DeviceContextType {
    deviceMode: DeviceMode;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
    // Always use tablet mode for consistent design
    const deviceMode: DeviceMode = "tablet";

    return (
        <DeviceContext.Provider value={{ deviceMode }}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => {
    const context = useContext(DeviceContext);
    if (context === undefined) {
        throw new Error("useDevice must be used within a DeviceProvider");
    }
    return context;
};
