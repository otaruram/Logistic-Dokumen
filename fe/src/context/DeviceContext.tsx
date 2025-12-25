import { createContext, useContext, useState, ReactNode } from "react";

type DeviceMode = "mobile" | "tablet" | "desktop";

interface DeviceContextType {
    deviceMode: DeviceMode;
    setDeviceMode: (mode: DeviceMode) => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider = ({ children }: { children: ReactNode }) => {
    const [deviceMode, setDeviceMode] = useState<DeviceMode>("mobile");

    return (
        <DeviceContext.Provider value={{ deviceMode, setDeviceMode }}>
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
