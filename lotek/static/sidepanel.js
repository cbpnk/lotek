export const SidePanel = {
    view:
    (vnode) => html`
<div class="container row-flex" style=${vnode.attrs.style}>
  <div style="flex-grow: 1;">${ vnode.children }</div>
  <div style="order: ${(vnode.attrs.position === 'right')?0:-1}; height: 100%; overflow-y: auto;">
    ${vnode.attrs.isOpen?vnode.attrs.panel:null}
  </div>
</div>`,
};
