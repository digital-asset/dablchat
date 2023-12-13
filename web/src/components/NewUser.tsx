import { EventHandler } from "react";
import TERMS_AND_CONDITIONS from "../termsAndConditions";

interface Props {
  partyName: string;
  handleAcceptInvitation: EventHandler<any>;
}

const NewUser = (props: Props) => {
  const { partyName, handleAcceptInvitation } = props;

  return (
    <div className="login-container">
      <div className="login">
        <div className="login-form">
          <h4>Hello {partyName},</h4>
          <h4>Welcome to Daml Chat!</h4>
          <span>Please Accept the terms of service to continue</span>
          <div
            className="terms-legal-text"
            dangerouslySetInnerHTML={{ __html: TERMS_AND_CONDITIONS }}
          />
          <button className="submit-btn" onClick={handleAcceptInvitation}>
            Accept Terms and Conditions
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewUser;
