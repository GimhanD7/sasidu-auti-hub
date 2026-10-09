// Render the public workshop landing page and navigation into booking and account access.
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { dashboardForRole } from '../auth/roles';
import './Home.css';

const currentYear = new Date().getFullYear();
const services = [
  [
    '01',
    'Routine maintenance',
    'Keep your vehicle ready for everyday journeys with servicing and oil changes.',
    'M5 7h14M7 3v4m10-4v4M5 7v14h14V7M9 12h6m-6 4h4',
  ],
  [
    '02',
    'Brakes & repairs',
    'Request help with brake issues, unusual noises, and general vehicle repairs.',
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3v3m0 12v3M3 12h3m12 0h3',
  ],
  [
    '03',
    'Vehicle diagnostics',
    'Describe an engine or electrical concern so the workshop can investigate.',
    'M3 12h4l3-8 4 16 3-8h4',
  ],
];

export default function Home() {
  const { user } = useAuth();
  const customer = user && ['Customer', 'user'].includes(user.role);
  const destination = user
    ? customer
      ? '/customer/appointments'
      : dashboardForRole(user.role)
    : '/signup';
  const action = user && !customer ? 'Open dashboard' : 'Book a service';
  return (
    <div className="home-page">
      <a className="home-skip" href="#home-main">
        Skip to content
      </a>
      <header className="home-nav home-wrap">
        <Link className="home-brand" to="/home" aria-label="AutoServ Pro home">
          <span className="home-mark">
            A<span>↗</span>
          </span>
          AutoServ<span className="home-brand-pro">Pro</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#services">Services</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <Link className="home-nav-login" to={user ? dashboardForRole(user.role) : '/login'}>
          {user ? 'My dashboard' : 'Sign in'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main id="home-main">
        <section className="home-hero home-wrap">
          <div className="home-hero-copy">
            <p className="home-eyebrow">
              <span /> YOUR VEHICLE. OUR FOCUS.
            </p>
            <h1>
              Good care.
              <br />
              Clear updates.
              <br />
              <em>Back on the road.</em>
            </h1>
            <p className="home-intro">
              From your first booking to the final invoice, keep every part of your vehicle’s
              service in one place.
            </p>
            <div className="home-actions">
              <Link className="home-button" to={destination}>
                {action} <span aria-hidden="true">↗</span>
              </Link>
              <a className="home-text-link" href="#services">
                Explore services <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className="home-hero-note">
              <span aria-hidden="true">✓</span> Choose your time. Follow the progress. Keep the
              record.
            </div>
          </div>
          <div
            className="home-visual"
            aria-label="Illustration of a vehicle and the service journey"
          >
            <div className="home-visual-top">
              <span>AUTOSERV / SERVICE STUDIO</span>
              <span>01 — 03</span>
            </div>
            <div className="home-orbit" />
            <svg
              className="home-car"
              viewBox="0 0 640 320"
              role="img"
              aria-label="Side profile of a red car"
            >
              <defs>
                <linearGradient id="home-paint" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#ff5261" />
                  <stop offset="1" stopColor="#961329" />
                </linearGradient>
                <linearGradient id="home-glass">
                  <stop stopColor="#58616b" />
                  <stop offset="1" stopColor="#151920" />
                </linearGradient>
              </defs>
              <ellipse cx="322" cy="271" rx="259" ry="16" fill="#000" opacity=".5" />
              <path
                d="M61 202l30-35 97-18 73-64q14-12 38-12h96q30 0 53 20l73 63 55 15q20 6 23 27l6 36-31 17H75l-20-18z"
                fill="url(#home-paint)"
                stroke="#ff7180"
                strokeWidth="2"
              />
              <path
                d="M214 146l61-53h53v53zm128-53h49q23 0 39 16l42 37H342z"
                fill="url(#home-glass)"
                stroke="#9b9da3"
                strokeWidth="2"
              />
              <path
                d="M335 151v84M481 155l7 73M178 169h311M87 222h48m348 0h95"
                fill="none"
                stroke="#731326"
                strokeWidth="3"
              />
              <path d="M73 183h53l-9 17H63m506-20h20l7 17h-26" fill="#ffe3cc" />
              <path
                d="M357 166h23m-135 0h23"
                stroke="#ffb1b9"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {[169, 474].map((x) => (
                <g key={x}>
                  <circle cx={x} cy="239" r="46" fill="#101115" stroke="#68202a" strokeWidth="5" />
                  <circle cx={x} cy="239" r="29" fill="#424751" stroke="#b2b6bd" strokeWidth="3" />
                  <circle cx={x} cy="239" r="11" fill="#13161a" />
                  {[0, 60, 120].map((angle) => (
                    <path
                      key={angle}
                      d={`M${x} 213v52`}
                      stroke="#9da4ae"
                      strokeWidth="5"
                      transform={`rotate(${angle} ${x} 239)`}
                    />
                  ))}
                </g>
              ))}
            </svg>
            <div className="home-visual-caption">
              <span>CARE THAT KEEPS YOU MOVING</span>
              <strong>
                Every detail.
                <br />
                Every journey.
              </strong>
            </div>
            <div className="home-journey">
              <span>
                <b>01</b> Book
              </span>
              <i />
              <span>
                <b>02</b> Service
              </span>
              <i />
              <span>
                <b>03</b> Verify payment
              </span>
            </div>
          </div>
        </section>
        <section id="services" className="home-services home-wrap">
          <div className="home-section-heading">
            <div>
              <p className="home-eyebrow">BUILT AROUND YOUR VEHICLE</p>
              <h2>
                A little upkeep.
                <br />A lot of peace of mind.
              </h2>
            </div>
            <p>
              Routine care or something that needs a closer look—start by telling us what your
              vehicle needs.
            </p>
          </div>
          <div className="home-service-grid">
            {services.map(([number, title, description, path]) => (
              <article key={number}>
                <div className="home-service-top">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    aria-hidden="true"
                  >
                    <path d={path} />
                  </svg>
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <Link to={destination}>
                  Request a service <span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="home-process home-wrap">
          <div>
            <p className="home-eyebrow">LESS GUESSWORK. MORE CLARITY.</p>
            <h2>
              Your service,
              <br />
              step by step.
            </h2>
            <p>One account for your vehicles, appointments, updates, and invoices.</p>
          </div>
          <ol>
            {[
              [
                'Choose a time',
                'Add your vehicle, describe the problem, and request an appointment at your preferred time.',
              ],
              [
                'Follow the work',
                'The workshop confirms your booking and assigns a technician. Check service progress from your account.',
              ],
              [
                'Review and pay',
                'Review your invoice, submit your payment details, and receive confirmation after the workshop verifies payment.',
              ],
            ].map(([title, description], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="home-start home-wrap">
          <div>
            <p className="home-eyebrow">YOUR NEXT SERVICE STARTS HERE</p>
            <h2>Let’s keep you moving.</h2>
            <p>Create your customer account and request your next appointment.</p>
          </div>
          <Link className="home-button" to={destination}>
            {action} <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
      <footer className="home-footer home-wrap">
        <span>
          AutoServ Pro <small>Vehicle care, connected.</small>
        </span>
        <nav aria-label="Staff access">
          <Link to="/admin/login">Admin sign in</Link>
          <Link to="/technician/login">Technician sign in</Link>
        </nav>
        <small>© {currentYear} AutoServ Pro</small>
      </footer>
    </div>
  );
}
