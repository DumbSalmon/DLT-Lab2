"use client";

import { FormEvent, useEffect, useState } from "react";
import { Web3 } from "web3";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const contractAddress = process.env.NEXT_PUBLIC_POSTER_ADDRESS!;

const posterAbi = [
  {
    type: "event",
    name: "NewPost",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "content", type: "string" },
      { indexed: false, name: "tag", type: "string" },
    ],
  },
  {
    type: "function",
    name: "post",
    stateMutability: "nonpayable",
    inputs: [
      { name: "content", type: "string" },
      { name: "tag", type: "string" },
    ],
    outputs: [],
  },
] as const;

type Post = {
  user: string;
  content: string;
  tag: string;
  txHash: string;
};

export default function Home() {
  const [account, setAccount] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [filter, setFilter] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState("");

  function getContract() {
    if (!window.ethereum) {
      throw new Error("MetaMask не найден. Установите расширение MetaMask.");
    }

    const web3 = new Web3(window.ethereum);
    const contract = new web3.eth.Contract(
      posterAbi as any,
      contractAddress,
    ) as any;

    return { contract };
  }

  async function loadPosts() {
  if (!window.ethereum) {
    setStatus("MetaMask не найден.");
    return;
  }

  try {
    const { contract } = getContract();

    const latestBlockHex = (await window.ethereum.request({
      method: "eth_blockNumber",
    })) as string;

    const fromBlock = Math.max(
      0,
      parseInt(latestBlockHex, 16) - 9999,
    );

    const events = (await contract.getPastEvents("NewPost", {
      fromBlock,
      toBlock: "latest",
    })) as any[];

    const loadedPosts = events
      .map((event) => ({
        user: event.returnValues.user,
        content: event.returnValues.content,
        tag: event.returnValues.tag,
        txHash: event.transactionHash,
      }))
      .reverse();

    setPosts(loadedPosts);
    setStatus("");
  } catch (error) {
    console.error("Ошибка загрузки сообщений:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    setStatus(`Не удалось загрузить сообщения: ${message}`);
  }
}

  async function connectWallet() {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setAccount(accounts[0]);
      setStatus("Кошелёк подключён.");
      await loadPosts();
    } catch (error) {
      setStatus("Не удалось подключить кошелёк.");
    }
  }

  async function publishPost(event: FormEvent) {
    event.preventDefault();

    if (!account) {
      setStatus("Сначала подключите MetaMask.");
      return;
    }

    if (!content.trim() || !tag.trim()) {
      setStatus("Заполните текст сообщения и тег.");
      return;
    }

    try {
      setStatus("Подтвердите транзакцию в MetaMask...");

      const { contract } = getContract();

      await contract.methods
        .post(content.trim(), tag.trim())
        .send({ from: account });

      setContent("");
      setTag("");
      setStatus("Сообщение опубликовано.");
      await loadPosts();
    } catch {
      setStatus("Транзакция не выполнена или была отклонена.");
    }
  }

  useEffect(() => {
    loadPosts();
  }, []);

  const visiblePosts = posts.filter((post) =>
    post.tag.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow">
        <h1 className="mb-2 text-3xl font-bold">Poster dApp</h1>
        <p className="mb-4">Публикация сообщений в сети Sepolia.</p>

        <button
          onClick={connectWallet}
          className="mb-4 rounded bg-blue-600 px-4 py-2 text-white"
        >
          {account ? "Кошелёк подключён" : "Подключить MetaMask"}
        </button>

        {account && (
          <p className="mb-4 break-all">
            Подключённый адрес: {account}
          </p>
        )}

        <form onSubmit={publishPost} className="mb-6 space-y-3">
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Текст сообщения"
            className="w-full rounded border p-2"
          />

          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Тег, например учеба"
            className="w-full rounded border p-2"
          />

          <button
            type="submit"
            className="rounded bg-green-600 px-4 py-2 text-white"
          >
            Опубликовать
          </button>
        </form>

        <p className="mb-4">{status}</p>

        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Фильтр по тегу"
          className="mb-4 w-full rounded border p-2"
        />

        <button
          onClick={loadPosts}
          className="mb-4 rounded bg-zinc-700 px-4 py-2 text-white"
        >
          Обновить список
        </button>

        <section className="space-y-3">
          {visiblePosts.map((post) => (
            <article key={post.txHash} className="rounded border p-3">
              <p className="font-semibold">{post.content}</p>
              <p>Тег: #{post.tag}</p>
              <p className="break-all text-sm">Автор: {post.user}</p>
              <a
                className="text-blue-600 underline"
                href={`https://sepolia.etherscan.io/tx/${post.txHash}`}
                target="_blank"
              >
                Открыть транзакцию
              </a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}