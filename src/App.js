import React, { useState, useEffect } from "react";
import "./App.css";
import "@aws-amplify/ui-react/styles.css";
import { API, Storage } from "aws-amplify";
import {
  Button,
  Flex,
  Heading,
  Image,
  Text,
  TextField,
  View,
  withAuthenticator,
} from "@aws-amplify/ui-react";
import { listNotes } from "./graphql/queries";
import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from "./graphql/mutations";

const App = ({ signOut }) => {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    fetchNotes();
  }, []);

  // promise.all 等待所有的异步处理完
  // 一般情况使用map足够 这里使用promiseall是因为
  // 需要等待所有异步处理完才能继续后面的操作
  async function fetchNotes() {
    const apiData = await API.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;
    await Promise.all(
      notesFromAPI.map(async (note) => {
        if (note.image) {
          const url = await Storage.get(note.name);
          note.image = url;
        }
        // 确保map()方法返回一个经过修改的笔记项对象
        return note;
      })
    );
    setNotes(notesFromAPI);
  }

  async function createNote(event) {
    // 防止form自己提交
    event.preventDefault();
    // 方便化 获取form
    const form = new FormData(event.target);
    const image = form.get("image");
    const data = {
      name: form.get("name"),
      description: form.get("description"),
      // 只储存了对应image的名字
      image: image.name,
    };
    // 双感叹检查是否存在或者为真值
    // 等待storage上传储存图片
    if (!!data.image) await Storage.put(data.name, image);
    await API.graphql({
      query: createNoteMutation,
      variables: { input: data },
    });
    // 刷新 显示新创建的笔记
    fetchNotes();
    // 重置表单
    event.target.reset();
  }

  // 解构note变成note的id 意思是要传一个包含id属性的对象
  // deleteAMutation A是model的名字
  async function deleteNote({ id, name }) {
    const newNotes = notes.filter((note) => note.id !== id);
    // 在删除笔记时 我们实际上已经拥有了需要的数据newNotes
    // 因此可以直接使用setNotes(newNotes)来更新状态
    // 而不需要再次发起请求
    setNotes(newNotes);
    await Storage.remove(name);
    await API.graphql({
      query: deleteNoteMutation,
      variables: { input: { id } },
    });
  }

  return (
    <View className="App">
      <Heading level={1}>My Notes App</Heading>
      <View as="form" margin="3rem 0" onSubmit={createNote}>
        <Flex direction="row" justifyContent="center">
          <TextField
            name="name"
            placeholder="Note Name"
            label="Note Name"
            labelHidden
            variation="quiet"
            required
          />
          <TextField
            name="description"
            placeholder="Note Description"
            label="Note Description"
            labelHidden
            variation="quiet"
            required
          />
          {/* 接收用户选择的文件 */}
          <View
            name="image"
            as="input"
            type="file"
            style={{ alignSelf: "end" }}
          />
          <Button type="submit" variation="primary">
            Create Note
          </Button>
        </Flex>
      </View>
      <Heading level={2}>Current Notes</Heading>
      <View margin="3rem 0">
        {notes.map((note) => (
          <Flex
            key={note.id || note.name}
            direction="row"
            justifyContent="center"
            alignItems="center"
          >
            <Text as="strong" fontWeight={700}>
              {note.name}
            </Text>
            <Text as="span">{note.description}</Text>
            {/* 一个条件渲染的部分 它会检查note.image是否存在
            如果note.image存在则会渲染一个<Image>组件来显示该图片 */}
            {/* JSX中我们不能使用常规的if语句 所以用三元 */}
            {note.image && (
              <Image
                // 我储存到了storage里面了 所以后续
                // 我想要访问这种图片 可以直接访问图片的名字
                src={note.image}
                alt={`visual aid for ${notes.name}`}
                style={{ width: 400 }}
              />
            )}
            <Button variation="link" onClick={() => deleteNote(note)}>
              Delete note
            </Button>
          </Flex>
        ))}
      </View>
      <Button onClick={signOut}>Sign Out</Button>
    </View>
  );
};

export default withAuthenticator(App);