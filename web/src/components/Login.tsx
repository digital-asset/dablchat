import { FunctionComponent } from "react";

interface Props {}

const Login: FunctionComponent<Props> = (_: Props) => (
  <div className="login-container">
    <div className="login">
      <a className="submit-btn dabl-login" href="/.hub/v2/auth/login">
        Log In with Daml Hub
      </a>
    </div>
  </div>
);

export default Login;
