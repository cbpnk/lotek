const Action = {
    view: function(vnode) {
        let username = USER_ID;

        function logout() {
            USER_ID = null;
            m.request(
                {method: "POST",
                 url: "/auth/logout",
                 headers: {'X-CSRF-Token': CSRF_TOKEN},
                }
            );
        }

        if (USER_ID) {
            return html`
<div class="dropdown text-left">
  <button class="btn btn-link btn-sm dropdown-toggle" tabindex="0">
    ${ username }
    <i class="icon icon-caret" />
  </button>
  <ul class="menu">
    <li class="menu-item">
      <${m.route.Link} href="${ m.buildPathname("/~:username", {username}) }">Profile<//>
    </li>
    <li class="menu-item"><a onclick=${ logout }>Sign out</a></li>
  </ul>
</div>`;
        }

        return html`
<div class="input-group input-inline">
  <a class="btn btn-sm" href="${ m.buildPathname("/openid/redirect", {next: window.location.pathname}) }">Sign in</a>
</div>`;
    }
};

const Login = {
    oninit(vnode) {
    },
    view(vnode) {
    }
};

export const logins = [
    {name: "OpenID",
     component: Login
    }
];
