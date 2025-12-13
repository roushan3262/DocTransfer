import React from 'react';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    return (
        <>
            <SignedIn>
                {children}
            </SignedIn>
            <SignedOut>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100vh',
                    background: '#f8fafc' // Light background for better contrast
                }}>
                    <SignIn routing="hash" />
                </div>
            </SignedOut>
        </>
    );
};

export default ProtectedRoute;
