const Layout = {
    view: function(vnode) {
        const path = window.location.pathname;

        return html`
${vnode.children}
<header>
  <ul class=tab>
    ${ registry.links.map(
         (link) =>
         html`
         <li class="tab-item ${path===link.url?"active":""}">
            <${m.route.Link} href=${link.url}>${ link.name }<//>
         </li>
         `
       )
    }
    <li class="tab-item tab-action">
      ${ registry.actions.map((action) => m(action, {})) }
    </li>
  </ul>
</header>
<footer class=py-2/>`;
    }
};

function authenticate(args, requestedPath, route) {
    if (!authenticated) {
        return Authenticate;
    }
}

function main() {
    m.route.prefix = "";
    m.route(
        document.body,
        registry.links[0].url,
        Object.fromEntries(
            Object.entries(registry.routes).map(
                ([key, value]) =>
                [key,
                 {render: function(vnode) {
                      return m(Layout, value(vnode));
                  }}]
            ))
    );
}

export const registry = {
    routes: {},
    links: [],
    actions: []
};

export const onload = [main];
