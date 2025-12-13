import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import {
  Shield,
  FileText,
  Lock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  File,
  Upload,
  Download,
  Share2,
  Mail,
  Droplets,
  FileCheck,
  ScrollText,
  Activity,
  BarChart3,
  Bell
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      question: "How secure is my data?",
      answer: "Your files are protected with enterprise-grade security. All data is encrypted in transit with HTTPS/TLS and stored securely in Supabase's encrypted storage. We implement password protection, email verification, and granular access controls to keep your documents safe."
    },
    {
      question: "Can I track who views my documents?",
      answer: "Yes! Our real-time analytics dashboard shows you exactly who viewed your document, when, for how long, and even which pages they spent the most time on."
    },
    {
      question: "Do recipients need an account?",
      answer: "No. Recipients can view documents directly in their browser via a secure link without needing to sign up or install any software."
    },
    {
      question: "Can I update a document after sending it?",
      answer: "Absolutely. You can update the underlying file at any time without changing the link. Everyone with the link will instantly see the new version."
    },
    {
      question: "What types of files can I share?",
      answer: "You can share PDFs, Word documents, PowerPoint presentations, Excel spreadsheets, images (JPEG, PNG, GIF), and many other common file formats. Our platform supports virtually any document type."
    },
    {
      question: "Is there a file size limit?",
      answer: "Free accounts can upload files up to 50MB. Premium users enjoy unlimited file sizes, making it easy to share large presentations, high-resolution images, and comprehensive reports."
    },
    {
      question: "How much does DocTransfer cost?",
      answer: "We offer a generous free tier for individuals. For teams and businesses, our premium plans start at competitive rates with advanced features like custom branding, priority support, and enhanced analytics."
    },
    {
      question: "Can I set expiration dates for shared links?",
      answer: "Yes! You have complete control over link expiration. Set specific dates, time limits, or view count restrictions. Links can also be manually revoked at any time for maximum security."
    },
    {
      question: "How do watermarks work?",
      answer: "Watermarks are dynamically applied to documents with viewer information like email, timestamp, and IP address. This prevents unauthorized redistribution and helps track document leaks."
    },
    {
      question: "Can recipients sign documents?",
      answer: "Absolutely! You can request e-signatures from recipients. They can digitally sign documents directly in their browser, and you'll receive instant notifications when signatures are completed."
    },
    {
      question: "Do you integrate with other tools?",
      answer: "Yes, we integrate with popular tools like Slack, Microsoft Teams, Google Drive, Dropbox, and more. You can also use our API to build custom integrations with your existing workflows."
    },
    {
      question: "How long are my documents stored?",
      answer: "Documents are stored securely for as long as you need them. Free users get 30 days of storage, while premium users enjoy unlimited storage duration with automatic backups and version history."
    }
  ];

  return (
    <div className="landing-page">
      <header className="header">
        <div className="logo">
          <FileText size={28} />
          <span>DocTransfer</span>
        </div>
        <nav>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#security">Security</a>
          </div>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-primary">Sign In</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link to="/dataroom">
                <button className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Dashboard</button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="hero">
          {/* Floating Background Elements */}
          <div className="floating-elements">
            <div className="floating-icon floating-1"><FileText size={40} /></div>
            <div className="floating-icon floating-2"><Upload size={35} /></div>
            <div className="floating-icon floating-3"><Download size={38} /></div>
            <div className="floating-icon floating-4"><Share2 size={32} /></div>
            <div className="floating-icon floating-5"><File size={36} /></div>
            <div className="floating-icon floating-6"><FileText size={34} /></div>

            <div className="floating-orb orb-1"></div>
            <div className="floating-orb orb-2"></div>
            <div className="floating-orb orb-3"></div>
          </div>

          <h1 className="hero-title-animated">Securely Sharing, Tracking and Manage All Document</h1>
          <p className="hero-subtitle-animated">Share documents securely with real-time insights and control. Join over 10,000+ teams who trust DocTransfer.</p>
          <div className="hero-actions">
            <Link to="/dataroom">
              <button className="btn-primary">Get Started Free</button>
            </Link>
            <button className="btn-secondary">View Pricing</button>
          </div>

          <div className="transfer-animation-container">
            <div className="transfer-scene">
              {/* Sender Side */}
              <div className="transfer-node sender-node">
                <div className="node-avatar">
                  <Upload size={32} />
                </div>
                <div className="node-label">Sender</div>
                <div className="node-status">Uploading...</div>
              </div>

              {/* Transfer Path with Animated Documents */}
              <div className="transfer-path">
                <div className="transfer-line">
                  <div className="transfer-pulse"></div>
                </div>

                {/* Animated Flying Documents */}
                <div className="flying-doc doc-1">
                  <FileText size={24} />
                </div>
                <div className="flying-doc doc-2">
                  <File size={22} />
                </div>
                <div className="flying-doc doc-3">
                  <FileCheck size={20} />
                </div>

                {/* Data Particles */}
                <div className="particle particle-1"></div>
                <div className="particle particle-2"></div>
                <div className="particle particle-3"></div>
                <div className="particle particle-4"></div>
                <div className="particle particle-5"></div>
                <div className="particle particle-6"></div>
              </div>

              {/* Receiver Side */}
              <div className="transfer-node receiver-node">
                <div className="node-avatar">
                  <Download size={32} />
                </div>
                <div className="node-label">Receiver</div>
                <div className="node-status">Receiving...</div>
              </div>
            </div>

            {/* Security Badges */}
            <div className="security-badges">
              <div className="security-badge">
                <Lock size={16} />
                <span>Encrypted Storage</span>
              </div>
              <div className="security-badge">
                <Shield size={16} />
                <span>Secure Transfer</span>
              </div>
              <div className="security-badge">
                <CheckCircle size={16} />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="security-section" id="security">
          <span className="section-badge">Enterprise-Grade Security</span>
          <h2>Enterprise-Grade Security for Your Files</h2>
          <p style={{ maxWidth: '600px', margin: '1rem auto', color: '#6b7280' }}>
            We take security seriously. Your data is encrypted and protected at every step.
          </p>

          <div className="security-content">
            <div className="security-image">
              <div style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)', padding: '3rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={120} color="#6366f1" strokeWidth={1} />
              </div>
            </div>
            <div className="security-details">
              <h3>AES-256 Encryption Standard</h3>
              <p style={{ marginBottom: '2rem', color: '#6b7280' }}>
                Your files are encrypted in your browser using military-grade AES-256-GCM encryption before they ever reach our servers. We can't read your files, and neither can anyone else.
              </p>
              <ul className="security-list">
                <li>
                  <CheckCircle className="check-icon" size={24} />
                  <span>Client-side encryption (Zero-Knowledge)</span>
                </li>
                <li>
                  <CheckCircle className="check-icon" size={24} />
                  <span>Granular access controls and permissions</span>
                </li>
                <li>
                  <CheckCircle className="check-icon" size={24} />
                  <span>Automatic expiration and self-destruct</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="features-section" id="features">
          <div className="features-header">
            <span className="section-badge">Key Features</span>
            <h2>Enterprise-Grade Document Security</h2>
            <p style={{ maxWidth: '700px', margin: '1rem auto', color: '#6b7280', fontSize: '1.1rem' }}>
              Comprehensive tools to secure, track, and control your sensitive documents with confidence.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                  <Lock size={28} />
                </div>
              </div>
              <h3>Password Protection</h3>
              <p>Secure files with password-protected links. Add an extra layer of security ensuring only authorized recipients can access your sensitive documents.</p>
              <div className="feature-highlight">🔐 Secure password protection</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' }}>
                  <Mail size={28} />
                </div>
              </div>
              <h3>Email Verification</h3>
              <p>Require recipients to verify their email address to access documents. Ensure your files reach the intended recipient and maintain audit compliance.</p>
              <div className="feature-highlight">✉️ Identity assured</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' }}>
                  <Droplets size={28} />
                </div>
              </div>
              <h3>Dynamic Watermarking</h3>
              <p>Apply watermarks with viewer details and custom text. Prevent unauthorized sharing and maintain document traceability with personalized watermarks.</p>
              <div className="feature-highlight">💧 Customizable branding</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}>
                  <Download size={28} />
                </div>
              </div>
              <h3>Download Controls</h3>
              <p>Restrict or allow document downloads. Control how recipients interact with your files - view-only mode or full download permissions.</p>
              <div className="feature-highlight">⚙️ Granular permissions</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' }}>
                  <FileCheck size={28} />
                </div>
              </div>
              <h3>Audit Trail</h3>
              <p>Maintain a complete log of all user activity for compliance and transparency. Track every view, download, and interaction with detailed timestamps.</p>
              <div className="feature-highlight">📊 Complete visibility</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)' }}>
                  <ScrollText size={28} />
                </div>
              </div>
              <h3>NDA Agreements</h3>
              <p>Require recipients to agree to Non-Disclosure Agreements before viewing. Legally protect your confidential information with digital signatures.</p>
              <div className="feature-highlight">📝 Legal protection</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)' }}>
                  <Activity size={28} />
                </div>
              </div>
              <h3>Real-time Analytics</h3>
              <p>Track document views and engagement in real-time. Monitor who's viewing your documents as it happens with live dashboard updates.</p>
              <div className="feature-highlight">⚡ Live tracking</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' }}>
                  <BarChart3 size={28} />
                </div>
              </div>
              <h3>Page-by-Page Analytics</h3>
              <p>Gain detailed insights into how viewers interact with individual pages. See which pages get the most attention and where readers drop off.</p>
              <div className="feature-highlight">📈 Deep insights</div>
            </div>

            <div className="feature-card premium-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)' }}>
                  <Bell size={28} />
                </div>
              </div>
              <h3>Instant Alerts</h3>
              <p>Receive notifications when documents are viewed or shared. Stay informed with real-time alerts via email or in-app notifications.</p>
              <div className="feature-highlight">🔔 Stay notified</div>
            </div>
          </div>
        </section>

        {/* Animated Features Showcase */}
        <section className="animated-showcase">
          <div className="showcase-container">
            {/* Feature Wave 1 */}
            <div className="showcase-item wave-1">
              <div className="showcase-icon">
                <Lock size={32} />
              </div>
              <h3>Password Protection</h3>
              <p>Secure your files with password protection</p>
            </div>

            {/* Feature Wave 2 */}
            <div className="showcase-item wave-2">
              <div className="showcase-icon">
                <Activity size={32} />
              </div>
              <h3>Real-Time Analytics</h3>
              <p>Track views and engagement as it happens</p>
            </div>

            {/* Feature Wave 3 */}
            <div className="showcase-item wave-3">
              <div className="showcase-icon">
                <Bell size={32} />
              </div>
              <h3>Instant Notifications</h3>
              <p>Get alerted when documents are accessed</p>
            </div>

            {/* Feature Wave 4 */}
            <div className="showcase-item wave-4">
              <div className="showcase-icon">
                <Droplets size={32} />
              </div>
              <h3>Custom Watermarks</h3>
              <p>Protect against unauthorized sharing</p>
            </div>

            {/* Animated Background Elements */}
            <div className="showcase-glow glow-1"></div>
            <div className="showcase-glow glow-2"></div>
            <div className="showcase-glow glow-3"></div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-card">
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>Start for free</span>
            <h2>Everything you need to share securely</h2>
            <p style={{ maxWidth: '600px', margin: '0 auto', opacity: 0.9 }}>
              Join thousands of professionals who trust DocTransfer for their document sharing needs.
            </p>
            <div className="cta-buttons">
              <Link to="/dataroom">
                <button className="btn-white">Get Started Now</button>
              </Link>
              <button style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}>Contact Sales</button>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div key={index} className={`faq-item ${openFaq === index ? 'active' : ''}`} onClick={() => toggleFaq(index)}>
                <div className="faq-question">
                  {faq.question}
                  {openFaq === index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                <div className="faq-answer">
                  {faq.answer}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-col">
            <div className="logo" style={{ marginBottom: '1rem' }}>
              <FileText size={24} />
              <span>DocTransfer</span>
            </div>
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              Secure document sharing and analytics for modern teams.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#">Features</a></li>
              <li><a href="#">Security</a></li>
              <li><a href="#">Pricing</a></li>
              <li><a href="#">Enterprise</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About Us</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '3rem', color: '#9ca3af', fontSize: '0.875rem' }}>
          &copy; 2025 DocTransfer. All rights reserved.
        </div>
      </footer>
    </div >
  );
};

export default LandingPage;
