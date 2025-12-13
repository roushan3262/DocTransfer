import React from 'react';
import './TrustedCompanies.css';

const TrustedCompanies: React.FC = () => {
    // Define companies component helper to avoid code duplication
    const CompanyLogos = () => (
        <>
            {/* Yuno */}
            <div className="company-logo-item">
                <span className="yuno-text">yuno</span>
                <span className="yuno-tm">TM</span>
            </div>

            {/* DP World */}
            <div className="company-logo-item">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 2C8.26801 2 2 8.26801 2 16C2 23.732 8.26801 30 16 30C23.732 30 30 23.732 30 16" stroke="#2e1065" strokeWidth="3" strokeLinecap="round" />
                    <path d="M30 16C30 8.26801 23.732 2 16 2" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="dpworld-text">DP WORLD</span>
            </div>

            {/* Realtor.com */}
            <div className="company-logo-item">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#dc2626' }}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span className="realtor-text">realtor.com</span>
            </div>

            {/* Brevo */}
            <div className="company-logo-item">
                <span className="brevo-text">Brevo</span>
            </div>

            {/* Vercel */}
            <div className="company-logo-item">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: 'black' }}>
                    <path d="M12 1L24 22H0L12 1Z" fill="currentColor" />
                </svg>
                <span className="vercel-text">Vercel</span>
            </div>

            {/* Mistral AI */}
            <div className="company-logo-item">
                <div className="mistral-icon-grid">
                    <div className="mistral-dot" style={{ backgroundColor: '#facc15' }}></div>
                    <div className="mistral-dot" style={{ backgroundColor: '#fb923c' }}></div>
                    <div className="mistral-dot" style={{ backgroundColor: '#f87171' }}></div>
                </div>
                <span className="mistral-text">Mistral AI</span>
            </div>

            {/* Stripe */}
            <div className="company-logo-item">
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 900, fontSize: '1.8rem', color: '#635bff', letterSpacing: '-0.02em' }}>stripe</span>
            </div>

            {/* Airbnb */}
            <div className="company-logo-item">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="currentcolor" style={{ color: '#ff385c' }} xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 1c2.008 0 3.463.963 4.751 3.269 2.054 3.738 3.322 8.783 3.322 8.783s1.208-4.103 4.706-4.128c1.696-.012 3.14.747 4.14 2.158 1.134 1.6 1.306 4.079.034 7.294-1.848 4.672-8.152 11.233-15.694 12.607l-1.259.017-1.264-.017c-7.542-1.374-13.846-7.935-15.694-12.607-1.272-3.214-1.1-5.694.034-7.294 1.001-1.411 2.444-2.17 4.14-2.158 3.498.025 4.706 4.128 4.706 4.128s1.268-5.045 3.322-8.783C8.537 1.963 9.992 1 12 1c0 0 0 0 0 0h4zm0 2c-1.24 0-2.227.633-3.257 2.478-1.571 2.858-2.671 6.815-3.048 8.682l-.127.697-.101.594-.211-.274c-.584-.73-2.316-2.583-4.116-2.601-.849-.009-1.554.34-2.071 1.07-1.314 1.855.975 6.096 4.293 10.323 3.511 4.475 7.07 6.446 8.638 6.711 1.568-.265 5.127-2.236 8.638-6.711 3.318-4.227 5.607-8.468 4.293-10.323-.517-.73-1.222-1.079-2.071-1.07-1.802.018-3.535 1.874-4.115 2.604l-.21.272-.102-.594-.127-.697c-.377-1.867-1.477-5.824-3.048-8.682C18.227 3.633 17.24 3 16 3z" />
                </svg>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: '#ff385c', letterSpacing: '-0.05em' }}>airbnb</span>
            </div>

            {/* Google */}
            <div className="company-logo-item">
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '1.6rem', color: '#5f6368' }}>Google</span>
            </div>

            {/* Microsoft */}
            <div className="company-logo-item">
                <div className="flex gap-1 flex-wrap w-6 h-6 mr-1" style={{ width: '24px', height: '24px', display: 'flex', flexWrap: 'wrap', gap: '1px' }}>
                    <div style={{ width: '11px', height: '11px', backgroundColor: '#f25022' }}></div>
                    <div style={{ width: '11px', height: '11px', backgroundColor: '#7fba00' }}></div>
                    <div style={{ width: '11px', height: '11px', backgroundColor: '#00a4ef' }}></div>
                    <div style={{ width: '11px', height: '11px', backgroundColor: '#ffb900' }}></div>
                </div>
                <span style={{ fontFamily: 'Segoe UI, sans-serif', fontWeight: 600, fontSize: '1.5rem', color: '#737373' }}>Microsoft</span>
            </div>

            {/* Slack */}
            <div className="company-logo-item">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5.042 15.123a2.52 2.52 0 1 0 0-5.04 2.52 2.52 0 0 0 0 5.04zM5.042 16.376a2.52 2.52 0 1 0 2.52 2.52v-2.52h-2.52zM8.815 15.123a2.52 2.52 0 1 0 0-5.04 2.52 2.52 0 0 0 0 5.04zM8.815 10.082a2.52 2.52 0 1 0 2.52-2.52h-2.52v2.52zM8.815 5.042a2.52 2.52 0 1 0 0 5.04 2.52 2.52 0 0 0 0-5.04zM7.561 5.042a2.52 2.52 0 1 0-2.52 2.52v-2.52h2.52zM15.123 10.082a2.52 2.52 0 1 0 0 5.04 2.52 2.52 0 0 0 0-5.04zM15.123 8.829a2.52 2.52 0 1 0-2.52-2.52v2.52h2.52z" fill="#4A154B" />
                    <path d="M15.123 15.123a2.52 2.52 0 1 0 0-5.04 2.52 2.52 0 0 0 0 5.04zM16.376 15.123a2.52 2.52 0 1 0-2.52 2.52h2.52v-2.52z" fill="#4A154B" />
                </svg>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1.6rem', color: '#4A154B', letterSpacing: '-0.03em' }}>slack</span>
            </div>

            {/* Spotify */}
            <div className="company-logo-item">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1DB954' }} xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.019.6-1.139 4.44-1.32 9.841-.6 13.441 1.619.42.3.6.84.3 1.2zm.12-3.36C15.24 8.46 8.82 8.28 5.161 9.36c-.6.179-1.141-.181-1.32-.78-.18-.6.18-1.2.78-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '1.5rem', color: '#1DB954', letterSpacing: '-0.02em' }}>Spotify</span>
            </div>
        </>
    );

    return (
        <section className="trusted-companies-section">
            <div className="trusted-companies-container">
                <p className="trusted-companies-title">
                    Trusted by innovative teams worldwide
                </p>

                <div className="trusted-companies-marquee-mask">
                    <div className="trusted-companies-marquee-track">
                        {/* First copy of logos */}
                        <div className="trusted-companies-logos">
                            <CompanyLogos />
                        </div>

                        {/* Second copy for seamless scrolling */}
                        <div className="trusted-companies-logos">
                            <CompanyLogos />
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};

export default TrustedCompanies;
