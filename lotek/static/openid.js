import {get_token, clear_token} from "/static/auth.js";

const Action = {
    view: function(vnode) {
        let token = get_token();
        let username = token;

        function logout() {
            clear_token();
            m.redraw();
        }

        if (token) {
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

export const actions = [Action];

export const searches = [{name: "Users", query: "category_i:user"}];
export const categories = {
    user: {
        name: "User",
        readonly: true}
};
