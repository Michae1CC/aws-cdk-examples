export default function NavigationBar() {
  return (
    <div className="navbar">
      <div className="nav-elements">
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/create">Create</a>
          </li>
          <li>
            <a href="/search">Search</a>
          </li>
          <li>
            <a href="https://testpoolauth01.auth.us-east-1.amazoncognito.com/authorize?identity_provider=auth0idp&client_id=508cbe40iour98ka15km5c0uej&response_type=token&scope=aws.cognito.signin.user.admin+email+openid+phone&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Flogin">
              Login
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
