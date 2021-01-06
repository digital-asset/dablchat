import React from 'react';

const Login = props => {
  const { partyId, handleSubmit, handleUserInput, handleTokenInput, token } = props;

  const showLoginWithDABL = window.location.hostname !== 'localhost';

  const getLoginUrl = () => {
    let host = window.location.host.split('.');
    const ledgerId = host[0];
    let loginUrl = host.slice(1)
    loginUrl.unshift('login')

    return loginUrl.join('.') + (window.location.port ? ':' + window.location.port : '')
      + '/auth/login?ledgerId=' + ledgerId;
  }

  const loginUrl = (showLoginWithDABL && getLoginUrl()) || ""

  return (
    <div className="login-container">
      <div className="login">
        <form className="login-form" onSubmit={handleSubmit}>
          {showLoginWithDABL && (
            <>
              <a className="submit-btn dabl-login" href={`https://${loginUrl}`}>Log In with DABL</a>
              <label className="username-label" style={{"text-align": "center", "margin-top" : "10px"}} htmlFor="username">
                OR
              </label>
            </>)}
          <label className="username-label" htmlFor="username">
            Party
          </label>
          <input className="username-input" type="text" id="username" name="partyId" value={partyId} onChange={handleUserInput} placeholder="Party ID"/>
          <label className="username-label" htmlFor="username">
            Token
          </label>
          <input
            id="secret"
            className="username-input"
            autoFocus
            type="password"
            name="token"
            value={token}
            onChange={handleTokenInput}
            placeholder="Party JWT"
          />
          <button type="submit" className="submit-btn">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
