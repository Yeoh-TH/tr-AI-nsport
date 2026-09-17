import { useState } from 'react'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import { faDoorClosed, faFan, faPallet, faLineChart} from '@fortawesome/free-solid-svg-icons';
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <span  style={{color: 'var(--accent)'}}>
            <FontAwesomeIcon icon={faDoorClosed} size="sm" className="icon" fade/>
          </span>
          <h2>Door</h2>
          <p>Temporal segment detection — find each door-open/close cycle in a continuous stream and classify it normal vs. abnormal-resistance</p>
        </div>
        <div id="social">
          <span style={{color: 'var(--accent)'}}>
            <FontAwesomeIcon icon={faFan} size="lg" className="icon" spin/>
          </span>
          <h2>ACV</h2>
          <p>	Fault diagnosis / localisation — identify the car with a refrigerant leak</p>
        </div>
      </section>

      <section id="next-steps">
        <div id="docs">
          <span style={{color:'var(--accent)'}}>
            <FontAwesomeIcon icon={faPallet} size="lg" className="icon" bounce shake buzz/>
          </span>
          <h2>Rail Corrugation</h2>
          <p>Multi-class classification — Normal / Side I / Side II corrugation</p>
        </div>
        <div id="social">
          <span style={{color:'var(--accent)'}}>
            <FontAwesomeIcon icon={faLineChart} size="lg" className="icon" fade/>
          </span>
          <h2>SHM</h2>
          <p>Regression — cumulative fatigue damage estimation</p>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
