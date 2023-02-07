import Head from "next/head";
import Web3Modal from "web3modal";
import styles from "@/styles/Home.module.css";
import { useRef, useState, useEffect } from "react";
import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";

export default function Home() {
  //keeping track of whether wallet connected or not
  const [walletConnected, setWallectConnected] = useState(false);
  //keeping track of user's Crypto Devs nft balance
  const [nftBalance, setNftBalance] = useState(0);
  //keeping track of DAO treasury balance  // ETH Balance of the DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  //keeping track of numbers of proposals  // Number of proposals created in the DAO
  const [numProposals, setNumProposals] = useState("0");
  // Array of all proposals created in the DAO
  const [proposals, setProposals] = useState([]);
  // Fake NFT Token ID to purchase. Used when creating a proposal.
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  // One of "Create Proposal" or "View Proposals"
  const [selectedTab, setSelectedTab] = useState("");
  // True if waiting for a transaction to be mined, false otherwise.
  const [loading, setLoading] = useState(false);
  //reference of web3modal instance using useRef() hook so that it's value can persist throughout the session
  const web3ModalRef = useRef();

  // Reads the balance of the user's CryptoDevs NFTs and sets the `nftBalance` state variable
  const getUserNFTBalance = async () => {
    try {
      //signer coz we want to get address of user
      const signer = await getProviderOrSigner(true);
      //not adding await coz it don't return any promise
      const nftContract = getCryptodevsNFTContractInstance(signer);
      const balance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(balance.toString()));
    } catch (err) {
      console.error(err);
    }
  };

  // Reads the ETH balance of the DAO contract and sets the `treasuryBalance` state variable
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      const balance = await provider.getBalance(
        CRYPTODEVS_DAO_CONTRACT_ADDRESS
      );
      setTreasuryBalance(balance.toString());
    } catch (err) {
      console.error(err);
    }
  };

  // Reads the number of proposals in the DAO contract and sets the `numProposals` state variable
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner();
      //not adding await coz it don't return any promise
      const daoContract = getDaoContractInstance(provider);
      const daoNumProposals = await daoContract.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (err) {
      console.error(err);
    }
  };

  // Helper function to return a DAO Contract instance
  // given a Provider/Signer
  //no need to declare it async coz it is just returning new contract instance and it is not returning any promise
  const getDaoContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    );
  };

  // Helper function to return a CryptoDevs NFT Contract instance
  // given a Provider/Signer
  //no need to declare it async coz it is just returning new contract instance and it is not returning any promise
  const getCryptodevsNFTContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    );
  };

  // Calls the `createProposal` function in the contract, using the tokenId from `fakeNftTokenId`
  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await txn.wait();
      //calling it so it can update numProposal state variable
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper function to fetch and parse one proposal from the DAO contract
  // Given the Proposal ID
  // and converts the returned data into a Javascript object with values we can use
  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString() * 1000)),
        yayVotes: proposal.yayVotes,
        nayVotes: proposal.nayVotes,
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (err) {
      console.error(err);
    }
  };

  // Runs a loop `numProposals` times to fetch all proposals in the DAO
  // and sets the `proposals` state variable
  const fetchAllProposals = async () => {
    try {
      const proposals = [];
      for (let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
    } catch (err) {
      console.error(err);
    }
  };

  // Calls the `voteOnProposal` function in the contract, using the passed
  // proposal ID and Vote
  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      let vote = _vote == "YAY" ? 0 : 1;
      const txn = await daoContract.voteOnProposal(vote, proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (err) {
      console.error(err);
      window.alert(err.data.message);
    }
  };

  // Calls the `executeProposal` function in the contract, using
  // the passed proposal ID
  const executeProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (err) {
      console.error(err);
      window.alert(err.data.message);
    }
  };

  //function to get provider or signer
  const getProviderOrSigner = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    //actually this line connects to wallet
    const provider = await web3ModalRef.current.connect(); //metamask
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Goerli network, let them know and throw an error
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 5) {
      window.alert("Change the network to Goerli");
      throw new Error("Change network to Goerli");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  //function to connect wallet
  // piece of code that runs everytime the value of `walletConnected` changes
  // so when a wallet connects or disconnects
  // Prompts user to connect wallet if not connected
  // and then calls helper functions to fetch the
  // DAO Treasury Balance, User NFT Balance, and Number of Proposals in the DAO
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWallectConnected(true);
    } catch (error) {
      console.error(error);
    }
  };

  //function written using useEffect hook runs when first time page loads or whenever value of walletConnected changes
  useEffect(() => {
    //if wallet is not connected then create new web3modal objectand storing it's value in current value of web3modalRef
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });
    }

    connectWallet().then(() => {
      getDAOTreasuryBalance();
      getUserNFTBalance();
      getNumProposalsInDAO();
    });
  }, [walletConnected]);

  // Piece of code that runs everytime the value of `selectedTab` changes
  // Used to re-fetch all proposals in the DAO when user switches
  // to the 'View Proposals' tab
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  // Render the contents of the appropriate tab based on `selectedTab`
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  // Renders the 'Create Proposal' tab content
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (nftBalance === 0) {
      //if user don't have any nft then he/she can't create proposal
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      );
    } else {
      //html for creating proposal
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            type="number"
            placeholder="0"
            onChange={(e) => {
              setFakeNftTokenId(e.target.value);
            }}
          />
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  // Renders the 'View Proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>No proposals have been created</div>
      );
    } else {
      return (
        <div>
          {/* .map function runs the function on every element of array */}
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{""}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div>
      <Head>
        <title>Crypo Devs DAO</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs DAO!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("View Proposals")}
            >
              View Proposals
            </button>
            {renderTabs()}
          </div>
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>Made with &#10084; by Arpit</footer>
    </div>
  );
}

//<-------------steps for code of this file----------->

//first add header, footer and initial description for UI

//Then provide functionality of wallet connection:
//{use useEffect hook for callin walletConnect function and create connectWallet()
//In this function, call getProviderOrSigner() to get provider or signer}

//once user enter and wallet is connceted uset should get to know about user's nft balance, DAO treasury balabce and
//total number of proposals :
//{then create functions
//getDaoContractInstance() and getCryptodevsNFTContractInstance() functions to get the instances of DAO contract and nft contract
//{create state variables nftBalance, numProposals and treasuryBalance and create functions getUserNFTBalance(),
//getDAOTreasuryBalance() and getNumProposalsInDAO() to get the value and store them in state variables and then show it on UI
//call these three functions in useState hook whose dependency array contains walletConncted so that we can get latest values
//after connection of wallet}

//now we want to give user buttons to crate proposal and view proposal:
// {first create two buttons Create Proposal and view proposal
// create selectedTab state variable which will be used to render content on UI based on which button is pressed(create proposal
// or view proposal) and then create renderTab() function which will call renderCreateProposalTab() and renderViewProposalsTab()
// functions based vale of selectedTab state variable,declare loading state variable which will be used to show "Loading"
// whenever any transaction will be ongoing, create fakeNftTokenId state variable to store value of tokenId of nft while filling
//input value in renderCreateProposalTab() function, create createProposal(), create proposals state variable to store array of
//all created proposals, create voteOnProposal() and executeProposal() functions, create fetchAllProposals() function which
//updates proposals state variable, write fetchProposalById() which is called in fetchAllProposals(),
//write useEffect hook with dependency array selectedTab}
