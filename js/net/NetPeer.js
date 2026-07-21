/**
 * NetPeer.js
 * ---------------------------------------------------------------------------
 * A minimal WebRTC data-channel wrapper using **manual (copy-paste) signaling**
 * so online 1v1 works with NO backend — which is exactly what a static host
 * (GitHub Pages) allows. The host generates an offer code; the guest pastes it
 * and returns an answer code; the host pastes that back. ICE is gathered fully
 * before a code is produced (no trickle) so a single code carries everything.
 *
 * A public STUN server is used only to discover candidates; all game traffic
 * flows peer-to-peer over the data channel. This file is browser-only and is
 * never imported by the Node test harness.
 * ---------------------------------------------------------------------------
 */
export class NetPeer {
  constructor() {
    this.pc = null;
    this.channel = null;
    this.isHost = false;
    this.onOpen = null;
    this.onMessage = null;
    this.onClose = null;
  }

  _newPC() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'disconnected' || s === 'failed' || s === 'closed') this.onClose?.();
    };
    return pc;
  }

  _bindChannel(ch) {
    ch.onopen = () => this.onOpen?.();
    ch.onclose = () => this.onClose?.();
    ch.onmessage = (e) => {
      let data = e.data;
      try { data = JSON.parse(e.data); } catch { /* keep raw */ }
      this.onMessage?.(data);
    };
    this.channel = ch;
  }

  /** Wait until ICE gathering completes so the SDP is self-contained. */
  _waitIce(pc) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(resolve, 3000); // fallback so we never hang forever
    });
  }

  /* ------------------------------- host --------------------------------- */
  /** Host: create the connection + data channel, return the offer code. */
  async createOffer() {
    this.isHost = true;
    this.pc = this._newPC();
    this._bindChannel(this.pc.createDataChannel('game', { ordered: true }));
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this._waitIce(this.pc);
    return this._encode(this.pc.localDescription);
  }

  /** Host: finalise using the guest's answer code. */
  async acceptAnswer(code) {
    await this.pc.setRemoteDescription(this._decode(code));
  }

  /* ------------------------------- guest -------------------------------- */
  /** Guest: consume the host's offer code, return the answer code. */
  async acceptOfferCreateAnswer(code) {
    this.isHost = false;
    this.pc = this._newPC();
    this.pc.ondatachannel = (e) => this._bindChannel(e.channel);
    await this.pc.setRemoteDescription(this._decode(code));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this._waitIce(this.pc);
    return this._encode(this.pc.localDescription);
  }

  /* ------------------------------- io ----------------------------------- */
  send(obj) {
    if (this.channel && this.channel.readyState === 'open') {
      this.channel.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
    }
  }

  get open() { return this.channel && this.channel.readyState === 'open'; }

  close() {
    try { this.channel?.close(); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    this.channel = this.pc = null;
  }

  /* SDP <-> short-ish code (base64 of {type, sdp}). */
  _encode(desc) { return btoa(JSON.stringify({ t: desc.type, s: desc.sdp })); }
  _decode(code) { const o = JSON.parse(atob(code.trim())); return { type: o.t, sdp: o.s }; }
}
